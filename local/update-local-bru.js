const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../src/api/.env') });

const updateLocalBru = (envPath) => {
    const localBruPath = path.resolve(__dirname, '../MEDIA_API/environments/LOCAL.BRU');

    try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        let localBruContent = fs.readFileSync(localBruPath, 'utf-8');

        const envVars = {};
        envContent.split('\n').forEach((line) => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    envVars[key.trim()] = value.trim();
                }
            }
        });

        const varsBlockPattern = /vars\s*\{([\s\S]*?)\}/;
        const match = localBruContent.match(varsBlockPattern);
        if (!match) {
            console.error('No vars block found in local.BRU');
            process.exit(1);
        }

        let varsBlockContent = match[1];

        Object.keys(envVars).forEach((key) => {
            const regex = new RegExp(`\\s*${key}:`, 'g');
            if (!varsBlockContent.match(regex)) {
                varsBlockContent += `  ${key}: ${envVars[key]}\n`;
            }
        });

        const updatedBruContent = localBruContent.replace(varsBlockPattern, `vars {\n${varsBlockContent}}`);

        fs.writeFileSync(localBruPath, updatedBruContent, 'utf-8');
        console.log('local.BRU updated successfully.');
    } catch (error) {
        console.error('Error while updating local.BRU:', error);
        process.exit(1);
    }
};

const envPath = path.resolve(__dirname, '../MEDIA_API/.env');
updateLocalBru(envPath);
