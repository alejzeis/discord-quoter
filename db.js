var nextId;

function randomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function loadNextId(db) {
    let collection = db.collection("metadata");
    return new Promise((resolve, reject) => {
        // Load nextId value
        collection.find({ key:"nextId" }).toArray((err, docs) => {
            if(err) {
                reject(err);
            } else {
                if(docs[0]) {
                    nextId = docs[0].value;
                    resolve();
                } else {
                    collection.insertOne({
                        key: "nextId",
                        value: 0
                    }, (err, result) => {
                        if(err) reject(err);
                        else {
                            nextId = 0;
                            resolve();
                        }
                    });
                }
            }
        });
    });
}

function updateNextId(collection) {
    nextId = nextId + 1;

    return new Promise((resolve, reject) => {
        collection.updateOne({
            key: "nextId"
        }, { $set: { value: nextId}}, (err, result) => {
            if(err) reject(err);
            else resolve();
        });
    });
}

function insertPinnedMessage(db, quoter, snowflake, senderId, sender, content) {
    return new Promise((resolve, reject) => {
        let collection = db.collection("quotes");
        let metaCollection = db.collection("metadata");
        let quoteId = nextId;

        collection.insertOne({
            quoter: quoter,
            snowflake: snowflake,
            quoteId: quoteId,
            senderId: senderId,
            sender: sender,
            content: content
        }, (err, result) => {
            if(!err) {
                updateNextId(metaCollection).then(() => resolve(quoteId)).catch((err) => reject(err));
            } else {
                reject(err);
            }
        });
    });
}

function removePinnedMessage(db, quoteId) {
    return new Promise((resolve, reject) => {
        let collection = db.collection("quotes");

        collection.deleteOne({
            quoteId: quoteId
        }, (err, result) => {
            if(err) reject(err);
            else resolve();
        });
    });
}

function removePinnedMessageBySnowflake(db, snowflake) {
    return new Promise((resolve, reject) => {
        let collection = db.collection("quotes");

        collection.deleteOne({
            snowflake: snowflake
        }, (err, result) => {
            if(err) reject(err);
            else resolve();
        });
    });
}

function findQuoteById(db, quoteId) {
    return new Promise((resolve, reject) => {
       let collection = db.collection("quotes");

       collection.findOne({
           quoteId: quoteId
       }, (err, result) => {
          if(err) reject(err);
          else resolve(result);
       });
    });
}

function findQuoteBySnowflake(db, snowflake) {
    return new Promise((resolve, reject) => {
        let collection = db.collection("quotes");

        collection.findOne({
            snowflake: snowflake
        }, (err, result) => {
            if(err) reject(err);
            else resolve(result);
        });
    });
}

function findRandomQuoteAny(db) {
    return new Promise((resolve, reject) => {
       let collection = db.collection("quotes");

       collection.find({}).toArray((err, docs) => {
          if(err) reject(err);
          else if(docs.length < 1) resolve(null);
          else {
              // Not subtracting 1 from array length since the max integer parameter is exclusive
              let index = randomInt(0, docs.length);
              resolve(docs[index]);
          }
       });
    });
}

module.exports = {
    loadNextId: loadNextId,
    insertPinnedMessage: insertPinnedMessage,
    removePinnedMessage: removePinnedMessage,
    removePinnedMessageBySnowflake: removePinnedMessageBySnowflake,
    findQuoteById: findQuoteById,
    findQuoteBySnowflake: findQuoteBySnowflake,
    findRandomQuoteAny: findRandomQuoteAny
};

