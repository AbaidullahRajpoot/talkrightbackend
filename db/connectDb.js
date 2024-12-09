const MongoClient = require('mongodb').MongoClient;

function ConnectionDb(Database_URL, callback) {
    const client = new MongoClient(Database_URL);
    
    client.connect()
        .then(function(client) {
            const db = client.db("Talkright");
            console.log("DataBase Connect Successfully........");
            callback(null, db);
        })
        .catch(function(error) {
            console.error("Something went wrong", error);
            callback(error, null);
        });
}

module.exports = ConnectionDb;