const chai = require('chai');
const expect = chai.expect; 
const net = require('net');
const fs = require('fs');
const path = require('path');
require('mocha-sinon');

// throw all props into global namespace (!?)
Object.assign(global, require(path.join(__dirname, '..', 'src', 'webby.js')));

// overwrite static to suppress keyword warning
global.serveStatic = global.static;


let socket;
const middleware = {f: (req, res, next) => [req, res, next] };
const route = {f: (req, res) => [req, res] };

function mockSocket() {

    socket = new net.Socket({});
    this.sinon.stub(socket, 'write').callsFake(function(s) { 
        return s;
    });

    this.sinon.stub(socket, 'end').callsFake(function() { 
        return null;
    });

    this.sinon.stub(socket, 'on').callsFake(function(event, f) { 
        return [event, f];
    });
}

function mockMiddleware() {
    this.sinon.stub(middleware, 'f').callsFake(function(req, res, next) {
        return [req, res, next];
    });
}

function mockRoute() {
    this.sinon.stub(route, 'f').callsFake(function(req, res) {
        return [req, res];
    });
}

function mockReadFile() {

    this.sinon.stub(fs, 'readFile').callsFake(function(fn, cb) { 
        return [fn, cb];
    });
}
describe('HTTP_STATUS_CODES and MIME_TYPES', function() {


    it('is defined and includes at least one status code', function() {
        expect(HTTP_STATUS_CODES.hasOwnProperty('200')).to.be.true;
    });

    it('is defined and includes at least one MIME type', function() {
        expect(MIME_TYPES.hasOwnProperty('html')).to.be.true;
    });
});


describe('serveStatic', function() {

    beforeEach(mockSocket);
    beforeEach(mockReadFile);

    it('gives back a function', function() {
        expect(serveStatic()).to.be.a('function');
    });

    it('gives back a function that calls readfile using the base path and path from the request object', function() {
        const f = serveStatic('/foo/bar/baz/');
        f(new Request('GET /qux/corge HTTP/1.1'), new Response(socket));
        expect(fs.readFile.getCall(0).args[0]).to.equal('/foo/bar/baz/qux/corge');
    });
});

describe('getExtension', function() {

    it('extracts extension - everything after last . (dot)', function() {
        expect(getExtension('foo.bar')).to.equal('bar');
        expect(getExtension('foo.bar.baz.qux')).to.equal('qux');
        expect(getExtension('foo.')).to.equal('');
    });

    it('empty string returned if no . (dot)', function() {
        expect(getExtension('foo')).to.equal('');
    });
});

describe('getMIMEType', function() {

    it('correct MIME type is given based on extension (for example .jpg or .jpeg map to image/jpeg)', function() {
        expect(getMIMEType('foo.jpg')).to.equal('image/jpeg');
        expect(getMIMEType('foo.jpeg')).to.equal('image/jpeg');
        expect(getMIMEType('foo.png')).to.equal('image/png');
        expect(getMIMEType('foo.css')).to.equal('text/css');
        expect(getMIMEType('foo.html')).to.equal('text/html');
    });

    it('empty string returned if extension is not supported', function() {
        expect(getMIMEType('foo')).to.equal('');
    });
});

describe('Request', function() {

    it('parses http method and path information into object properties', function() {
        let s = 'GET /foo.html HTTP/1.1\r\n';
        s += 'Host: localhost:8080\r\n';
        s += 'Referer: http://bar.baz/qux.html\r\n';
        s += '\r\n';
        const req = new Request(s);
        expect(req.method).to.equal('GET');
        expect(req.path).to.equal('/foo.html');
    });
});

describe('Response', function() {

    beforeEach(mockSocket);

    describe('constructor', function () {
        it('sets the sock property and the default values for http version and status code', function () {
            const res = new Response(socket);

            expect(res.sock).to.equal(socket);
            expect(res.statusCode).to.equal(200);
            expect(res.version).to.equal('HTTP/1.1');
        });
    });

    describe('statusLineToString', function() {
        it('generates an http status line as a string (and includes trailing \\r\\n)', function() {
            const s = 'HTTP/1.1 200 OK\r\n';
            const res = new Response(socket);
            res.statusCode = 200;

            expect(res.statusLineToString()).to.equal(s);
        });

        it('can create a new 404 http status line and turn it into a string', function() {
            const s = 'HTTP/1.1 404 Not Found\r\n';
            const res = new Response(socket);
            res.statusCode = 404;

            expect(res.statusLineToString()).to.equal(s);
        });

        it('can create a new 500 http response and turn it into a string', function() {
            const s = 'HTTP/1.1 500 Internal Server Error\r\n';
            const res = new Response(socket);
            res.statusCode = 500;

            expect(res.statusLineToString()).to.equal(s);
        });

    });

    describe('set', function() {
        it('can set a header', function() {
            const res = new Response(socket);
            res.set('Content-Type', 'text/plain');
            expect(res.headers['Content-Type']).to.equal('text/plain');
        });
    });

    describe('headersToString', function () {
        it('turn headers and body into a string', function () {
            let s = 'Content-Type: text/plain\r\n';
            s += 'X-Foo: bar\r\n';
            const res = new Response(socket);
            res.set('Content-Type', 'text/plain');
            res.set('X-Foo', 'bar');

            expect(res.headersToString()).to.equal(s);
        });
    });

    describe('end', function () {
        it('calls end once... when end is called', function () {
            const res = new Response(socket);
            res.end();

            expect(socket.end.callCount).to.equal(1);
        });
    });

    describe('status', function () {
        it('set the http response status on this object', function () {
            const res = new Response(socket);
            res.status(301);

            expect(res.statusCode).to.equal(301);
        });

        it('returns the response object it was called on', function () {
            const res = new Response(socket);
            const result = res.status();

            expect(result).to.equal(res);
        });
    });

    describe('send', function () {
        it('writes status line first', function () {
            const res = new Response(socket);
            const body = Buffer.from('foo');
            res.send(body);

            expect(socket.write.getCall(0).args[0]).contains('HTTP/1.1 200 OK');
        });

        it('sets default status (200)', function () {
            const res = new Response(socket);
            res.send('foo');

            expect(socket.end.callCount).to.equal(1);
            expect(res.statusCode).to.equal(200);
        });

        it('calls write at least twice (separate call for body versus other parts of request)', function () {
            const res = new Response(socket);
            res.send('foo');

            expect(socket.write.callCount).to.above(1);
            expect(socket.end.callCount).to.equal(1);
            expect(res.statusCode).to.equal(200);
        });

        it('calls write with same string passed in as argument (res.send("foo") eventually results in this.sock.write("foo") being called)', function () {
            const res = new Response(socket);
            const body = 'foo'
            res.send(body);

            expect(socket.write.calledWith(body)).to.be.true;
        });

        it('calls write with same exact argument that send was called with, even with Buffer (does not convert image to string)', function () {
            const res = new Response(socket);
            const body = Buffer.from('foo');
            res.send(body);

            expect(socket.write.calledWith(body)).to.be.true;
        });


    });

});

describe('App', function() {


    describe('constructor', function () {
        it('sets the routes, middleware and server values', function () {
            const app = new App();

            expect(app.routes).to.eql({});
            expect(app.middleware).to.be.null;
            expect(app.server).to.be.not.null;
        });
    });

    describe('use', function () {
        it('sets the middleware property', function () {
            const app = new App();
            const f = (req, res, net) => {};
            app.use(f);
            expect(app.middleware).to.equal(f);
        });
    });

    describe('get', function () {
        it('adds the function to the routes property', function () {
            const app = new App();
            const f = (req, res, net) => {};
            app.get('/foo', f);
            expect(app.routes[app.createRouteKey('GET', '/foo')]).to.equal(f);
        });
    });

    describe('createRouteKey', function () {
        it('puts together method and path to create a key', function () {
            const app = new App();
            const k = app.createRouteKey('GET', '/foo');
            expect(k).to.equal('GET /foo');
        });

        it('normalizes path casing to lowercase', function () {
            const app = new App();
            const k = app.createRouteKey('GET', '/FOO');
            expect(k).to.equal('GET /foo');
        });

        it('normalizes method casing to uppercase', function () {
            const app = new App();
            const k = app.createRouteKey('get', '/foo');
            expect(k).to.equal('GET /foo');
        });

        it('removes fragments', function () {
            const app = new App();
            const k = app.createRouteKey('GET', '/foo#bar');
            expect(k).to.equal('GET /foo');
        });

        it('removes query string', function () {
            const app = new App();
            const k = app.createRouteKey('GET', '/foo?bar=baz');
            expect(k).to.equal('GET /foo');
        });

        it('removes trailing slash', function () {
            const app = new App();
            const k = app.createRouteKey('GET', '/foo/');
            expect(k).to.equal('GET /foo');
        });

        it('traling slash followed by fragment or querystring', function () {
            const app = new App();
            const k1 = app.createRouteKey('GET', '/foo/?bar=baz');
            const k2 = app.createRouteKey('GET', '/foo/#bar');
            expect(k1).to.equal('GET /foo');
            expect(k2).to.equal('GET /foo');
        });
    });

    describe('normalizePath', function () {
        it('normalizes path casing to lowercase', function () {
            const app = new App();
            const p = app.normalizePath('/FOO');
            expect(p).to.equal('/foo');
        });

        it('removes fragments', function () {
            const app = new App();
            const p = app.normalizePath('/foo#bar');
            expect(p).to.equal('/foo');
        });

        it('removes query string', function () {
            const app = new App();
            const p = app.normalizePath('/foo?bar=baz');
            expect(p).to.equal('/foo');
        });

        it('removes trailing slash', function () {
            const app = new App();
            const p = app.normalizePath('/foo/');
            expect(p).to.equal('/foo');
        });

        it('traling slash followed by fragment or querystring', function () {
            const app = new App();
            const p1 = app.normalizePath('/foo/?bar=baz');
            const p2 = app.normalizePath('/foo/#bar');
            expect(p1).to.equal('/foo');
            expect(p2).to.equal('/foo');
        });
    });


    describe('handleConnection', function () {
        beforeEach(mockSocket);
        it('calls .on("data", callback) on socket object', function () {
            const app = new App();
            app.handleConnection(socket);
            expect(socket.on.callCount).to.equal(1);
            expect(socket.on.getCall(0).args[0]).to.equal('data');
        });
    });

    describe('handleRequest', function () {
        beforeEach(mockSocket);
        beforeEach(mockMiddleware);
        beforeEach(mockRoute);

        it('calls middleware if it\'s set', function () {
            const app = new App();
            app.use(middleware.f);
            app.handleRequest(socket, Buffer.from('GET /foo HTTP/1.1'));
            expect(middleware.f.callCount).to.equal(1);
        });

        it('calls route handling function that matches key if middleware is not set', function () {
            const app = new App();
            app.get('/foo', route.f);
            app.handleRequest(socket, Buffer.from('GET /foo HTTP/1.1'));
            expect(route.f.callCount).to.equal(1);
        });
    });

    describe('processRoutes', function () {
        beforeEach(mockSocket);
        beforeEach(mockRoute);

        it('calls route handling function that matches key if middleware is not set', function () {
            const req = new Request('GET /foo HTTP/1,1')
            const res = new Response(socket);
            const app = new App();

            app.get('/foo', route.f);
            app.processRoutes(req, res);
            expect(route.f.callCount).to.equal(1);
        });
    });
});
