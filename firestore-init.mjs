import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/tmp/service-account.json'));
const blueprint = JSON.parse(fs.readFileSync('./firebase-blueprint.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'novelwrite-27763'
});

const db = admin.firestore();

async function initializeFirestore() {
  try {
    console.log('🔄 Initializing Firestore schema...');
    
    let collectionsCreated = 0;
    let documentsCreated = 0;

    for (const [collName, collData] of Object.entries(blueprint.collections || {})) {
      console.log(`  └─ ${collName}`);
      
      if (collData.documents) {
        for (const [docId, docData] of Object.entries(collData.documents)) {
          await db.collection(collName).doc(docId).set(docData);
          documentsCreated++;
        }
      }
      collectionsCreated++;
    }

    console.log(`\n✅ Firestore initialized!`);
    console.log(`   Collections: ${collectionsCreated}`);
    console.log(`   Documents: ${documentsCreated}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initializeFirestore();
