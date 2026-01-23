
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars BEFORE importing the store
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('Running profile debug...');

    // Dynamic import to ensure env vars are loaded first
    const { updateUserProfile, getUserProfile, getAllUserProfiles } = await import('../src/lib/analysis-store');

    // Use random string instead of uuid to avoid dependency issues
    const uniqueId = Math.random().toString(36).substring(7);
    const testUser = 'DebugUser_' + uniqueId;

    const testAnalysis: any = {
        id: 'debug_' + Date.now(),
        username: testUser,
        author: 'Debug User',
        symbol: 'BTC',
        sentiment: 'BULLISH',
        performance: 10.5,
        isWin: true,
        timestamp: Date.now(),
        type: 'CRYPTO'
    };

    console.log(`1. Creating profile for ${testUser}...`);
    await updateUserProfile(testAnalysis);

    console.log(`2. Fetching profile for ${testUser}...`);
    const { profile, history } = await getUserProfile(testUser);

    if (profile) {
        console.log('✅ Profile found:', profile);
    } else {
        console.error('❌ Profile NOT found!');
    }

    if (history.length > 0) {
        console.log(`✅ History found: ${history.length} items`);
    } else {
        console.error('❌ History NOT found!');
    }

    console.log('3. Checking all profiles list...');
    const allProfiles = await getAllUserProfiles();
    const found = allProfiles.find(p => p.username === testUser);

    if (found) {
        console.log('✅ User found in All Profiles list');
    } else {
        console.error('❌ User NOT found in All Profiles list');
        const foundLower = allProfiles.find(p => p.username.toLowerCase() === testUser.toLowerCase());
        if (foundLower) {
            console.log('⚠️ User found but with different casing:', foundLower.username);
        }
    }
}

main().catch(console.error);
