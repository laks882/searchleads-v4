import { Actor } from 'apify';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Helper function for sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const run = async () => {
    await Actor.init();

    const input = await Actor.getInput();

    const headers = {
        Authorization: `Bearer ${process.env.SEARCHLEADS_API_KEY}`,
        'Content-Type': 'application/json',
    };

    const startRes = await axios.post(
        process.env.SEARCHLEADS_API_URL,
        {
            apolloLink: input.apolloLink,
            noOfLeads: input.noOfLeads,
            fileName: input.fileName,
        },
        { headers }
    );

    const logId = startRes.data?.record_id;
    if (!logId) throw new Error('Failed to get LogID from enrichment request.');

    let result = null;
    let retries = 0;
    const maxRetries = 60;

    while (retries < maxRetries) {
        const statusRes = await axios.post(
            process.env.SEARCHLEADS_STATUS_URL,
            { record_id: logId }
        );

        // Handle both array and object responses
        const data = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;
        const status = data?.enrichment_status;

        console.log(`Status: ${status} — Attempt ${retries + 1}/${maxRetries}`);

        // Check for completion (case insensitive)
        if (status && status.toLowerCase() === 'completed') {
            result = data;
            break;
        }

        // Check for failure states (case insensitive)
        if (status && (status.toLowerCase() === 'failed' || status.toLowerCase() === 'cancelled')) {
            throw new Error(`Enrichment ${status}`);
        }

        await sleep(10000); // ✅ Replaces Actor.sleep
        retries++;
    }

    if (!result) throw new Error('Timed out waiting for enrichment result.');

    await Actor.setValue('OUTPUT', result);
    await Actor.exit();
};

run();
