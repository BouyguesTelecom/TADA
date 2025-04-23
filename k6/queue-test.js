import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 5,
    duration: '10s',
};

const FILE_NAME = 'default.webp';
const TOKEN = 'Bearer token';

const fileData = open('../../local/images/' + FILE_NAME, 'b');

export default async function () {
    const formData = {
        file: http.file(fileData, `test-${__VU}-${__ITER}.webp`, 'image/webp'),
        name: `test-${__VU}-${__ITER}`,
        type: 'thumbnail',
        namespace: 'DEV'
    };

    const res = http.post(
        'http://localhost:3001/file',
        formData,
        {
            headers: {
                'Authorization': TOKEN
            },
        }
    );
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}
