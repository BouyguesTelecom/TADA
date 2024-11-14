const { execSync } = require('child_process');
const waitOn = require('wait-on');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async () => {
    console.log('Starting Docker Compose...');
    execSync('npm run docker:start', { stdio: 'inherit' });

    // Attendre que les services soient démarrés (healthcheck)
    console.log('Waiting for containers to start...');
    await sleep(5000);

    // Attend que Redis soit prêt
    console.log('Waiting for Redis to be ready...');
    await waitOn({
        resources: ['tcp:localhost:6379'],
        timeout: 15000
    });
    console.log('Redis is ready');
};
