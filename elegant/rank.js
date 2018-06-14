/* This script will generate a ranked white list 
 * text of android third party libraries according 
 * to the 3rdpartylibs.csv. Libraries information
 * in the csv file are obtained from 
 * https://github.com/codepath/android_guides/wiki/Must-Have-libraries.
 * The rank are based on a score, where,
 *    score = 0.15*watch + 0.5*star + 0.35*fork
 * For github project, the watch, star and fork 
 * are directly obtained. For non-github project, 
 * the watch, star and fork are assigned via experience.
 *
 * Put 3rdpartylibs.csv in this folder, and simply
 * run
 *  $ node rank.js
 * then a 3rdpartylibs.ranked.txt will be generated.
 */
const path = require('path');
const fs = require('fs');
const os = require('os')
const csv = require('csv');

const INTPUT_CSV_FILE = path.resolve(__dirname, '3rdpartylibs.csv');
const OUTPUT_TXT_FILE = path.resolve(__dirname, '3rdpartylibs.ranked.txt');
const readStream = fs.createReadStream(INTPUT_CSV_FILE);

const score = (w, s, f) => 0.15*w + 0.5*s + 0.35*f;
const output = []

parser = csv.parse({ delimiter: ',', comment: '#' });
parser.on('readable', () => {
  let x;
  let y;

  // transform content line by line
  while (x = parser.read()) {
    // skip header
    if ('pkg' === x[0]) {
      continue;
    }
    // x = [pkg, project, watch, star, fork]
    // y = [pkg, project, watch, star, fork, score]
    y = x.concat(score(parseInt(x[2]), parseInt(x[3]), parseInt(x[4])));
    output.push(y);
  }
});

parser.on('error', err => {
  console.error(err);
  process.exit(1);
});

parser.on('finish', (err, data) => {
  output.sort((x, y) => y[5] - x[5]);
  fs.writeFileSync(OUTPUT_TXT_FILE, output.map(x => x[0]).join('\n'))
})

readStream.pipe(parser)
