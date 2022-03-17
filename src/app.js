// app.js
const webby = require('./webby');
const path = require('path');
const fs = require('fs');

const app = new webby.App();
app.listen(3000, '127.0.0.1');

// logic for generating random images is here
// the website is about shoebill storks, hence the var names
function galleryFn (req, res) {

    // get rando # of stork images to serve 
    const numStorks = Math.floor(Math.random() * 3 + 1)
    let file;
    // serve a separate file based on #
    if (numStorks === 1) file = 'public/oneStork.html';
    else if (numStorks === 2) file = 'public/twoStork.html';
    else file = 'public/threeStork.html';

    // arr of possible images
    const arrOfStorks = ['stork1.jpg', 'stork2.jpg', 'stork3.jpg', 'stork4.jpg'];
    // arr of images to use
    let useStorks = [];
    for (let i = 0; i < numStorks; i++) {
        useStorks.push(arrOfStorks[Math.floor(Math.random()* 4)])
    }

    // read whichever html file was selected based on # of images
    fs.readFile(file, (err, data) => {
        if (err) {
            console.log('something went wrong in gallery');
        } else {
            let strData = data.toString();
            // "path1", "path2", and "path3" are placeholder strings
            // in the actual html meant to be replaced
            strData = strData.replace(/path1/, useStorks[0]);
            if (numStorks > 1) strData = strData.replace(/path2/, useStorks[1]);
            if (numStorks > 2) strData = strData.replace(/path3/, useStorks[2]);

            res.set('Content-Type', 'text/html');
            res.send(strData);
        }
    });
}

app.get('/gallery', galleryFn);

app.get('/pics', function (req, res) {

    res.status(301);
    res.set('Location', '/gallery');
    //console.log('/pics moved to /gallery ', res.statusCode);
    res.send('/pics moved to /gallery');
});

app.use(webby.static(path.join(__dirname, '..', 'public')));