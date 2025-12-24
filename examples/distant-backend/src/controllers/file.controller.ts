import path from 'path';
import { UPLOAD_DIR } from '../config/multer';
import { deleteOneFile } from '../services/file.service';
import fs from 'fs';
import { retrieveFileDirFromUniqueName } from '../utils/file';

export const deleteFiles = (req, res) => {
    const files = req.body;

    const processedItems = []
    for (let item of files) {
        const filePath = retrieveFileDirFromUniqueName(item.catalogItem.uniqueName);
        if (deleteOneFile(filePath)) {
            processedItems.push({
                file: filePath,
                success: true
            })
        }
        processedItems.push({
            file: filePath,
            success: false
        })
    }

    return res.status(200).json(processedItems)
}

export const deleteFile = (req, res) => {
    const files = req.body;

    const processedItems = []
    for (let item of files) {
        const filePath = item.catalogItem.uniqueName.replace(/\.[^/.]+$/, "");
        if (deleteOneFile(filePath)) {
            processedItems.push({
                file: filePath,
                success: true
            })
        }
        processedItems.push({
            file: filePath,
            success: false
        })
    }

    return res.status(200).json(processedItems)
}

export const addFile = (req, res) => {
    console.log(req.metadata)

    return res.status(200).json({
        message: 'Fichier reçu et sauvegardé',
    });
}

export const addFiles = (req: any, res: any) => {
    if (!req.files || req.files.length === 0) {
        console.log('Aucun fichier reçu');
        return res.status(400).json({
            data: null,
            error: 'Aucun fichier'
        });
    }
    // console.log("reqbody et files", req.body, req.files)

    const metadata = JSON.parse(req.body.file_0).catalogItem;
    // console.log(Object.keys(req.body).forEach(key => console.log(req.body[key]))
    // console.log(Object.values(req.body))

    const bodyValues: string[] = Object.values(req.body);

    return res.status(200).json({
        data: { files: bodyValues.map((item: string) => JSON.parse(item).file.filename) },
        error: null
    });
}

export const readFile = (req, res) => {
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
    const chemin = path.resolve(UPLOAD_DIR + req.query.filepath);

    if (!fs.existsSync(chemin)) {
        console.log("Le fichier n'existe pas sur le disque");
        return res.status(404).json({ error: 'Fichier physique introuvable' });
    }

    return res.sendFile(chemin);
}

export const overrideFile = (req, res) => {
    const oldImage = req.body;
    const newImage = req.files;

    const oldImagePath = path.join(UPLOAD_DIR, oldImage.unique_name);

    if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log('Ancienne image supprimée', oldImagePath);
    }

    const newImageBuffer = newImage[0].buffer;

    const newImagePath = oldImagePath;

    fs.writeFileSync(newImagePath, newImageBuffer);
    console.log('Nouvelle Image sauvé', newImagePath);

    return res.status(200).json(`Fichier modifié`);
}

export const overrideFiles = (req, res) => {

}