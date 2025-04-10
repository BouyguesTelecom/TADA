"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = void 0;
exports.default = default_1;
var http_1 = __importDefault(require("k6/http"));
var k6_1 = require("k6");
exports.options = {
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 }
    ]
};
function default_1() {
    // Récupérer le catalogue
    var catalogRes = http_1.default.get("".concat(__ENV.URL_API, "/catalog"));
    (0, k6_1.check)(catalogRes, { 'status est 200': function (r) { return r.status === 200; } });
    if (catalogRes.status !== 200) {
        return;
    }
    var catalog = JSON.parse(catalogRes.body);
    var uuid500ErrorCount = 0;
    // Pour chaque item du catalog tester public_url et /catalog/uuid
    for (var _i = 0, catalog_1 = catalog; _i < catalog_1.length; _i++) {
        var item = catalog_1[_i];
        // Tester la public_url (en bourrinant)
        for (var i = 0; i < 5; i++) {
            var urlRes = http_1.default.get(item.public_url);
            (0, k6_1.check)(urlRes, {
                'status est 200 ou 429': function (r) { return r.status === 200 || r.status === 429; }
            });
        }
        // Tester /catalog/uuid (en bourrinant)
        for (var i = 0; i < 5; i++) {
            var uuidRes = http_1.default.get("".concat(__ENV.URL_API, "/catalog/").concat(item.uuid));
            (0, k6_1.check)(uuidRes, {
                'status est 200 ou 429': function (r) { return r.status === 200 || r.status === 429; },
                'status est 500 trop d error': function (r) {
                    var maxError = 10;
                    if (r.status === 500 && uuid500ErrorCount < maxError) {
                        uuid500ErrorCount++;
                    }
                    return r.status === 500 ? false : true;
                }
            });
        }
    }
    (0, k6_1.sleep)(1);
}
