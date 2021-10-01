const functions = require("firebase-functions");
const admin = require('firebase-admin');
const Ftx = require('./ftx');

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

const ftx = new Ftx(functions.config().ftx);

// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.rebalanceFtx = functions
    .pubsub.schedule("* * * * *")
    .onRun(async (context) => {
        const rebalances = await db.collection('ftx_rebalances').get();
        rebalances.forEach(async (doc) => {
            const docData = doc.data();
            if (docData.enable) {
                await ftx.rebalance(docData);
            }
        });
    });