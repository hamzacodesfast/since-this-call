try {
    const IORedis = require('ioredis');
    console.log('✅ Standard require(ioredis) works in tsx');
} catch (e) {
    console.log('❌ Standard require(ioredis) failed:', e.message);
}
