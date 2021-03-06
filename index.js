

function deployConstitutionCSB(constitutionBundle, domainName, callback) {
    const EDFS = require('edfs');
    const brickStorageStrategyName = "http";


    if(typeof domainName=== "function" && typeof callback === "undefined"){
        callback = domainName;
        domainName = "";
    }

    const edfs = EDFS.attach(brickStorageStrategyName);

    edfs.createCSB((err, constitutionCSB) => {
        if (err) {
            return callback(err);
        }

        addFilesToArchive(constitutionBundle, constitutionCSB, (err)=>{
            if(err){
                return callback(err);
            }
            const lastHandler = willReturnSeed(constitutionCSB, callback);

            if(domainName !== ""){
                constitutionCSB.writeFile(EDFS.constants.CSB.DOMAIN_IDENTITY_FILE, domainName, lastHandler);
            }else{
                lastHandler();
            }
        });
    });
}

function deployConstitutionFolderCSB(constitutionFolder, domainName, callback) {
    const fs = require('fs');
    const path = require('path');

    fs.readdir(constitutionFolder, (err, files) => {
        if(err) {
            return callback(err);
        }

        files = files.map(file => path.join(constitutionFolder, file));
        deployConstitutionCSB(files, domainName, callback);
    });
}

function deployConstitutionBar(constitutionBundle, callback) {
    const EDFS = require('edfs');
    const brickStorageStrategyName = "http";

    const edfs = EDFS.attach(brickStorageStrategyName);
    const constitutionBAR = edfs.createBar();

    addFilesToArchive(constitutionBundle, constitutionBAR, willReturnSeed(constitutionBAR, callback));

}

function getConstitutionFilesFromBar(seed, callback) {
    const EDFS = require('edfs');
    const brickStorageStrategyName = "http";

    const edfs = EDFS.attach(brickStorageStrategyName);
    const constitutionBAR = edfs.loadBar(seed);

    getConstitutionFilesFrom(constitutionBAR, callback)
}

function getConstitutionFilesFromCSB(seed, callback) {
    loadCSB(seed, (err, constitutionCSB) => {
        if (err) {
            return callback(err);
        }

        getConstitutionFilesFrom(constitutionCSB, callback);
    });
}

function ensureEnvironmentIsReady(edfsURL) {
    const EDFS = require('edfs');
    const brickStorageStrategyName = "http";

    if (!$$.securityContext) {
        $$.securityContext = require("psk-security-context").createSecurityContext();
    }

    const hasHttpStrategyRegistered = $$.brickTransportStrategiesRegistry.has(brickStorageStrategyName);

    if (!hasHttpStrategyRegistered) {
        $$.brickTransportStrategiesRegistry.add(brickStorageStrategyName, new EDFS.HTTPBrickTransportStrategy(edfsURL));
    }
}

function loadCSB(seed, callback) {
    const EDFS = require('edfs');
    const Seed = require('bar').Seed;
    const brickStorageStrategyName = "http";

    const seedObject = new Seed(seed);
    ensureEnvironmentIsReady(seedObject.getEndpoint());

    const edfs = EDFS.attach(brickStorageStrategyName);
    edfs.loadCSB(seed, callback);
}

function createCSB(callback) {
    const EDFS = require('edfs');
    const brickStorageStrategyName = "http";

    const edfs = EDFS.attach(brickStorageStrategyName);

    edfs.createCSB(callback);
}

/****************************** UTILITY FUNCTIONS ******************************/

function addFilesToArchive(files, archive, callback) {
    const EDFS = require('edfs');
    const path = require('path');
    const fs = require('fs');

    if (typeof files === 'string') {
        files = [files];
    }

    asyncReduce(files, __addFile, null, callback);

    function __addFile(_, filePath, callback) {
        // archive.addFile(filePath, `${EDFS.constants.CSB.CONSTITUTION_FOLDER}/` + path.basename(filePath), callback);
        fs.stat(filePath, (err, stats) => {
            if(err) {
                return callback(err);
            }

            if(stats.isDirectory()) {
                 fs.readdir(filePath, (err, fileNames) => {
                     const filePaths = fileNames.map(fileName => path.join(filePath, fileName));
                     asyncReduce(filePaths, __addFile, null, callback);
                 });
                // archive.addFolder(filePath, EDFS.constants.CSB.CONSTITUTION_FOLDER, callback);
            } else {
                archive.addFile(filePath, `${EDFS.constants.CSB.CONSTITUTION_FOLDER}/` + path.basename(filePath), callback);
            }
        });
    }
}

function getConstitutionFrom(csb, cb){
    getConstitutionFilesFrom(csb, cb);
}


function getConstitutionFilesFrom(archive, specifiedFiles, callback) {
    const EDFS = require('edfs');
    const path = require('path');

    if(typeof specifiedFiles === 'function') {
        callback = specifiedFiles;
        specifiedFiles = undefined;
    }

    if(typeof specifiedFiles === "undefined") {
        specifiedFiles = []; // if specifiedFiles is not given as parameter or is explicitly given as undefined
    }

    archive.listFiles(EDFS.constants.CSB.CONSTITUTION_FOLDER, (err, files) => {
        if (err) {
            return callback(err);
        }

        if(specifiedFiles.length > 0) {
            files = files.filter(file => specifiedFiles.includes(path.basename(file)));
        }

        asyncReduce(files, __readFile, {}, callback);
    });


    function __readFile(pastFilesContent, filePath, callback) {
        archive.readFile(filePath, (err, fileContent) => {
            if (err) {
                return callback(err);
            }

            pastFilesContent[path.basename(filePath)] = fileContent;
            callback();
        });
    }
}

function willReturnSeed(archive, callback) {
    return function (err) {
        if (err) {
            return callback(err);
        }

        const seed = archive.getSeed();
        callback(undefined, seed);
    }
}

/**
 * Traverse an array and collects result from calling handler on each array of the element
 * It's similar to Array.prototype.reduce but it's asynchronous
 */
function asyncReduce(array, handler, currentValue, callback) {
    function __callNext(index = 0) {
        if (index >= array.length) {
            return callback(undefined, currentValue);
        }

        handler(currentValue, array[index], (err, newCurrentValue) => {
            if (err) {
                return callback(err);
            }

            if (newCurrentValue) {
                currentValue = newCurrentValue;
            }

            __callNext(index + 1);
        })
    }

    __callNext();
}

function getTmpDir(dirNamePrefix, callback) {
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const tmpFolder = os.tmpdir();
    fs.mkdtemp(path.join(tmpFolder, dirNamePrefix), callback);
}

module.exports = {
    deployConstitutionBar,
    deployConstitutionCSB,
    deployConstitutionFolderCSB,
    ensureEnvironmentIsReady,
    getConstitutionFilesFromBar,
    getConstitutionFilesFromCSB,
    loadCSB,
    createCSB,
    getConstitutionFrom,
    getConstitutionFilesFrom
};
