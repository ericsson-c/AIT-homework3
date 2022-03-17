// webby.js
const fs = require('fs');
const net = require('net');
const path = require('path');

const HTTP_STATUS_CODES = {
    200: 'OK',
    404: 'Not Found',
    301: 'Moved Permanently',
    500: 'Internal Server Error'
}

const MIME_TYPES = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'html': 'text/html',
    'css': 'text/css',
    'txt': 'text/txt'
}

function getExtension(fileName) {
    return path.extname(fileName).slice(1);
}

function getMIMEType(fileName) {
    const ext = getExtension(fileName);

    if (MIME_TYPES.hasOwnProperty(ext)) {
        return MIME_TYPES[ext];

    } else return ''
}

class Request {
    constructor(httpRequest) {
        const [method, path, ...other] = (httpRequest + '').split(' ');
        this.method = method;
        this.path = path;
    }
}


class Response {
    constructor(sock, statusCode=200, version="HTTP/1.1") {
        this.sock = sock;
        this.statusCode = statusCode;
        this.version = version;
        this.headers = {};
    }

    set(name, val) {
        this.headers[name] = val;
    }

    end() {
        this.sock.end();
    }

    statusLineToString() {
        return `${this.version} ${this.statusCode} ${HTTP_STATUS_CODES[this.statusCode]}\r\n`;
    }

    headersToString() {
        return Object.entries(this.headers).reduce( (prev, curr) => {
            prev += `${curr[0]}: ${curr[1]}\r\n`;
            return prev;
        }, '')
    }

    send(body) {
        if (!(this.headers.hasOwnProperty('Content-Type'))) {
            this.set('Content-Type', 'text/html');
        }
        const content = this.statusLineToString() + this.headersToString() 
        + '\r\n';

        this.sock.write(content);
        this.sock.write(body);
        this.end();
    }

    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    }
}

class App {
    
    // sets the callback func to this.handleConnection
    constructor() {
        this.server = net.createServer(sock => this.handleConnection(sock));
        this.routes = {};
        this.middleware = null;
    }
//  *** will probs only work on mac/linux systems where path seps are '/' 
    normalizePath(path) {
        // split on '/'
        let [...args] = path.split(/\/+/);
        // parse out http protocol, query string, fragments, and website
        const filters = [/http/, /\?\w+\=\w+/, /\#\w+/, /\w+\.\w+/];

        filters.forEach(filter => {
            args = args.map(s => s.replace(filter, ''));
        });
        
        // then join the remaining elements with '/'
        const ret = args.reduce( (prev, curr) => {
            if (curr !== '') {
                prev = prev + curr + '/';
            } return prev;
        }, '/');
        // zap that trailing '/'
        return ret.slice(0, ret.length-1).toLowerCase();
    }

    // method -> 'GET' or 'POST'
    // path -> normalized path of URL
    createRouteKey(method, path) {
        return `${method.toUpperCase()} ${this.normalizePath(path)}`;
    }

    get(path, cb) {
        this.routes[this.createRouteKey('GET', path)] = cb;
    }

    // only using one middleware, so this we can simply set the
    // 'middleware' property and call it a day
    use(cb) {
        this.middleware = cb;
    }

    listen(port, host) {
        this.server.listen(port, host);
    }

    handleConnection(sock) {
        sock.on('data', data => this.handleRequest(sock, data));
    }

    handleRequest(sock, binaryData) {
        const req = new Request(binaryData);
        const res = new Response(sock);
        const pr = this.processRoutes.bind(this);
        // call middleware if it is
        if (this.middleware !== null) {
            this.middleware(req, res, pr);

        // otherwise continue to route handler
        } else {
            this.processRoutes(req, res);
        }
    }

    processRoutes(req, res) {
        const key = this.createRouteKey(req.method, req.path);
        if (this.routes.hasOwnProperty(key)) {
            this.routes[key](req, res);
        
        } else {
            res.statusCode = '404';
            res.headers['Content-Type'] = 'text/txt';
            res.send('Page not found.');
        }
    }
}

// basePath -> where your app should attempt to read files from (dirname)
function serveStatic(basePath) {
    
    return function (req, res, next) {
        let newPath = path.join(basePath, '..', req.path);
        // serve index.html on '/'
        if (req.path === '/') {
            newPath = path.join(basePath, '..', '/public/index.html');
        }
        fs.readFile(newPath, (err, data) => {
            if (err) {
                next(req, res);
            } else {
                res.set('Content-Type', getMIMEType(newPath));
                res.send(data);
            }
        });
    } 
}

module.exports = {
    'getMIMEType': getMIMEType,
    'getExtension': getExtension,
    'MIME_TYPES': MIME_TYPES,
    'HTTP_STATUS_CODES': HTTP_STATUS_CODES,
    'Request': Request,
    'Response': Response,
    'App': App,
    'static': serveStatic
}