import express from 'express';  
import multer from 'multer';     
import path from 'path';         
import fs from 'fs';             
import dotenv from 'dotenv';
import { info } from 'console';
import { METHODS } from 'http';

dotenv.config();
const app = express();
const port = 3002;

const UPLOAD_DIR = process.env.UPLOAD_DIR;

if (!UPLOAD_DIR) {
    console.error('La variable UPLOAD_DIR doit être définie dans le fichier .env');
    process.exit(1);
}

const stockage = multer.diskStorage({
    destination: (req, file, callback) => {

      let namespace, destination;

        if (req.body.file_1) {
            const metadonnees = JSON.parse(req.body.file_1).catalogItem;
            namespace = metadonnees.namespace;
            destination = metadonnees.destination;
        } else {
            namespace = req.body.namespace;
            destination = req.body.destination;
        }

        const dossier = path.join(UPLOAD_DIR, namespace, destination)

        if (!fs.existsSync(dossier)) {
            fs.mkdirSync(dossier, { recursive: true });
        }
        callback(null, dossier);
    },
    filename: (req, file, callback) => {
        const nomFichier = file.originalname;
        console.log('Sauvegarde du fichier:', nomFichier);
        callback(null, nomFichier);
    }
});

const upload = multer({ storage: stockage }).any();

// Upload en mémoire pour PATCH (sans sauvegarde automatique)
const uploadMemoire = multer({ storage: multer.memoryStorage() }).any();


app.use(express.json());

function verifierToken(req: any, res: any, next: any) {
    const token = req.headers.authorization;
    if (token !== process.env.TOKEN) {
        console.log('Token incorrect:', token);
        return res.status(401).json({ error: 'Non autorisé' });
    }
    next(); 
}

app.get('/readiness-check', (req: any, res: any) => {
    console.log('Serveur OK');
    res.send('Serveur OK');
});

app.post('/files', verifierToken, upload, (req: any, res: any) => {
    if (!req.files || req.files.length === 0) {
        console.log('Aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier' });
    }
    
    const metadonnees = JSON.parse(req.body.file_1).catalogItem;

    res.status(200).json({
        version: 1,
        message: 'Fichier reçu et sauvegardé',
        filename: metadonnees.filename,
        métadonnées: metadonnees,
        size: metadonnees.size
    });

});

app.get('/file', verifierToken, (req: any, res: any) => {
    const { filepath, uuid } = req.query;
    const recherche = filepath || uuid;


    if (!recherche) {
        console.log('Aucun paramètre de recherche');
        return res.status(400).json({ error: 'Il faut filepath ou uuid' });
    }

    if (!recherche) {
        console.log('Fichier non trouvé');
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    const chemin = path.resolve(UPLOAD_DIR + req.query.filepath)

    if (!fs.existsSync(chemin)) {
        console.log('Le fichier n\'existe pas sur le disque');
        return res.status(404).json({ error: 'Fichier physique introuvable' });
    }

    return res.sendFile(chemin)
});

app.delete('/file', verifierToken, (req:any,res:any)=>{

    const uuid = req.body.uuid
    const data = req.body

    const cheminComplet = path.join(UPLOAD_DIR, data.namespace, data.destination);

    if(!uuid){
        console.log("UUID manqunat")
        return res.status(400).json({ error: 'Aucun UUID' });
    }

    const infosfichier = path.parse(data.unique_name)

    const folder = infosfichier.name

    const readDir = fs.readdirSync(cheminComplet)

    const folderToDelete = readDir.filter(fichier =>{
        const infosfichier = path.parse(fichier)
        return infosfichier.name === folder
    })

    console.log("folderToDetele",folderToDelete)

    folderToDelete.forEach(fichier =>{
        const cheminCompletFichier = path.join(cheminComplet, fichier);
        if(fs.existsSync(cheminCompletFichier)){
            fs.unlinkSync(cheminCompletFichier);
            console.log("Fichier supprimé:", cheminCompletFichier);
        } 
    })

    return res.status(200).json(`Fichier supprimé`);;
});

console.log("uploads",upload)

app.patch('/file', verifierToken, uploadMemoire, (req:any, res:any)=>{

    console.log("req.body:", req.body);
    console.log("req.files", req.files)

    
    const oldImage = req.body
    console.log("oldImage",oldImage, )
    
    const newImage = req.files
    console.log("newImages", newImage)
    
    const oldImagePath = path.join(UPLOAD_DIR, oldImage.unique_name)
    console.log("oldImaagePath",oldImagePath)

    if(fs.existsSync(oldImagePath)){
        fs.unlinkSync(oldImagePath)
        console.log("Ancienne image supprimée", oldImagePath)
    }

    const newImageBuffer = newImage[0].buffer;
    console.log("newImageBuffer", newImageBuffer)

    const newImagePath = oldImagePath

    fs.writeFileSync(newImagePath, newImageBuffer)
    console.log("Nouvelle Image sauvé", newImagePath)

    return res.status(200).json(`Fichier modifié`)

})


app.listen(port, () => {
    console.log('Serveur démarré sur http://localhost:' + port);

});