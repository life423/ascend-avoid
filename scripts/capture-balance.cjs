const { captureHoldMs } = require('../server/dist/game/cannon.js');
for (const ratio of [1.3,1.5,2,3,4,8]) console.log(JSON.stringify({ratio, holdMs:captureHoldMs(20*ratio,20), provisional:true}));
