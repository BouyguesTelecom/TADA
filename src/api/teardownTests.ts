const { execSync } = require('child_process');

module.exports = async () => {
    console.log('Stopping Docker Compose...');
    try {
        execSync('npm run docker:stop', { stdio: 'inherit' });
    } catch (error) {
        console.error('Error stopping Docker Compose services');
        console.error(error);
    }
};
