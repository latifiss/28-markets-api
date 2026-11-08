import 'dotenv/config';
import mongoose from 'mongoose';

async function removeLegacyPlanFields(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  try {
    const result = await mongoose.connection.collection('users').updateMany(
      {},
      {
        $unset: {
          tier: '',
          stripeCustomerId: '',
          subscriptionStatus: '',
          currentPeriodEnd: '',
        },
      },
    );

    console.info('Legacy account entitlement fields removed', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
    console.info('Historical subscription records were left untouched.');
  } finally {
    await mongoose.disconnect();
  }
}

removeLegacyPlanFields().catch((error) => {
  console.error('Legacy field migration failed:', error);
  process.exitCode = 1;
});
