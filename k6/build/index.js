"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = void 0;
exports.setup = setup;
exports.default = default_1;
var http_1 = __importDefault(require("k6/http"));
var k6_1 = require("k6");
function ensureHttpProtocol(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return "https://".concat(url);
    }
    return url;
}
var MEDIA_CATALOG_URL = ensureHttpProtocol(__ENV.CATALOG_URL);
var CONTENT_EDITOR_URL = ensureHttpProtocol(__ENV.MEDIA_LIBRARY_URL);
var IMAGES = [];
function getAuthToken() {
    return __awaiter(this, void 0, void 0, function () {
        var response, errorMessage, responseData, data;
        return __generator(this, function (_a) {
            console.log("🔑 Tentative d'authentification...");
            try {
                response = http_1.default.post("".concat(CONTENT_EDITOR_URL, "/auth/login"), JSON.stringify({
                    email: __ENV.ADMIN_EMAIL,
                    password: __ENV.ADMIN_PASSWORD
                }), {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (response.status !== 200) {
                    errorMessage = "\u00C9chec de l'authentification (".concat(response.status, "): ").concat(response.status_text);
                    console.error('❌', errorMessage);
                    throw new Error(errorMessage);
                }
                responseData = response.json();
                data = responseData;
                console.log('✅ Authentification réussie');
                return [2 /*return*/, data.data.access_token];
            }
            catch (error) {
                console.error("❌ Erreur d'authentification:", error instanceof Error ? error.message : String(error));
                throw error;
            }
            return [2 /*return*/];
        });
    });
}
function fetchCatalog() {
    return __awaiter(this, void 0, void 0, function () {
        var token, headers, response, errorMessage, responseData, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('📚 Récupération du catalogue...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getAuthToken()];
                case 2:
                    token = _a.sent();
                    headers = {
                        Authorization: "Bearer ".concat(token),
                        'Content-Type': 'application/json'
                    };
                    response = http_1.default.get("".concat(MEDIA_CATALOG_URL), {
                        headers: headers
                    });
                    if (response.status !== 200) {
                        errorMessage = "\u00C9chec de la r\u00E9cup\u00E9ration du catalogue (".concat(response.status, "): ").concat(response.status_text);
                        console.error('❌', errorMessage);
                        throw new Error(errorMessage);
                    }
                    responseData = response.json();
                    data = responseData;
                    console.log("\u2705 Catalog r\u00E9cup\u00E9r\u00E9 avec succ\u00E8s (".concat(data.data.length, " \u00E9l\u00E9ments), ").concat(MEDIA_CATALOG_URL));
                    return [2 /*return*/, data.data];
                case 3:
                    error_1 = _a.sent();
                    console.error('❌ Erreur lors de la récupération du catalogue:', error_1 instanceof Error ? error_1.message : String(error_1));
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.options = {
    scenarios: {
        load_test_images: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 }, // Montée progressive à 50 VUs
                { duration: '1m', target: 50 }, // Maintien à 50 VUs pendant 1 minute
                { duration: '30s', target: 0 } // Descente progressive
            ]
        }
    },
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% des requêtes doivent être sous 1s
        http_req_failed: ['rate<0.01'] // Moins de 1% d'erreurs
    }
};
function setup() {
    return __awaiter(this, void 0, void 0, function () {
        var catalogItems;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchCatalog()];
                case 1:
                    catalogItems = _a.sent();
                    IMAGES = catalogItems.map(function (item) { return item.public_url; });
                    console.log("\uD83C\uDF10 URLs des images r\u00E9cup\u00E9r\u00E9es: ".concat(IMAGES));
                    return [2 /*return*/];
            }
        });
    });
}
function default_1() {
    // Faire toutes les requêtes en parallèle
    var responses = http_1.default.batch(IMAGES.map(function (url) { return ({
        method: 'GET',
        url: url
    }); }));
    // Vérifier chaque réponse
    responses.forEach(function (response, index) {
        var _a;
        (0, k6_1.check)(response, (_a = {},
            _a["status is 200 for image ".concat(index + 1)] = function (r) { return r.status === 200; },
            _a["response time < 1000ms for image ".concat(index + 1)] = function (r) { return r.timings.duration < 1000; },
            _a));
    });
}
