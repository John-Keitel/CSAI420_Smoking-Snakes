/* eslint-disable */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
dotenv.config({ path: path.resolve(rootDir, '.env') });

// Check if API_URL environment variable exists
if (!process.env.API_URL) {
    console.error('\x1b[31m%s\x1b[0m', `
❌ ERROR: API_URL environment variable not set!
   Update the week1-integration-test.yaml file's API_URL environment variable to match your Vercel domain
   For local development, you can set it via:
   - .env file
   - export API_URL=https://your-api-url.com (bash/zsh)
   - set API_URL=https://your-api-url.com (Windows CMD)

   IMPORTANT: You need to deploy your own API to Vercel first, then use your
   own Vercel domain for these tests. Do not use the production domains.
`);
    process.exit(1); // Exit with error code
}

// Verify that the API_URL is not pointing to the production domains
const API_URL = process.env.API_URL;
if (API_URL.includes('dev.stedi.me') || API_URL.includes('stedi.me')) {
    console.error('\x1b[31m%s\x1b[0m', `
❌ ERROR: Invalid API_URL detected: ${API_URL}

   You are attempting to run tests against the example domain.
   This is not allowed for this assignment.

   Please follow these steps:
   1. Deploy your own API to Vercel first
   2. Get your Vercel domain (should look like: https://your-project-name.vercel.app)
   3. Update the week1-integration-test.yaml file's API_URL environment variable
      to match your Vercel domain
   4. Push your changes to GitHub

   IMPORTANT: These tests are meant to run against YOUR OWN deployed API, not the example API.
`);
    process.exit(1); // Exit with error code
}

let token = null;
const testData = {
    email: 'test_user@example.com',
    region: 'US',
    phone: '8014567890',
    birthDate: '2000-01-01',
    password: 'P@ssword123',
};

beforeAll(async () => {
    await createUser();
    token = await getToken();
    console.info('Session token: ', token);
    await createCustomer();
});


///// Test for IVR /////

describe('Backend Handling of IoT Device Data', () => {
    // Sends a single step to the server and checks the response
    it('should save step data from an IoT device', async () => {
        const mockData = {
            customer: testData.email,
            startTime: Date.now(),
            stepPoints: [100],
            deviceId: '000',
            totalSteps: 1,
        };
        const response = await fetch(`${API_URL}/rapidsteptest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'suresteps.session.token': token },
            body: JSON.stringify(mockData),
        });
        const data = await response.text();
        expect(response.status).toBe(200);
        expect(data).toBe('Saved');
    });

    // Sends step data to the server and requests the risk score
    it('should calculate a risk score', async () => {
        // Save mock step data
        await save30Steps(200);
        await save30Steps(200);
        await save30Steps(100);
        await save30Steps(100);

        // Get the risk score
        const response = await fetch(`${API_URL}/riskscore/${testData.email}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'suresteps.session.token': token },
        });
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.score > 0).toBe(true);
    });
});


///// Helper functions /////

// Create a test user
const createUser = async () => {
    // create the payload for the request
    const timestamp = Date.now();
    const payload = {
        userName: testData.email,
        email: testData.email,
        phone: testData.phone,
        region: testData.region,
        birthDate: testData.birthDate,
        password: testData.password,
        verifyPassword: testData.password,
        agreedToTermsOfUseDate: timestamp,
        agreedToCookiePolicyDate: timestamp,
        agreedToPrivacyPolicyDate: timestamp,
        agreedToTextMessageDate: timestamp,
    };
    // send a POST request to create a new user
    try {
        const response = await fetch(`${API_URL}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (response.status !== 200 && response.status !== 409)
            console.error('Failed to create a test user. Response status: ', response.status);
    } catch (error) {
        console.error('Error creating a test user: ', error);
    }
};

// Create a customer for the test user
const createCustomer = async () => {
    // create the payload for the request
    const payload = {
        customerName: 'Test User',
        email: testData.email,
        region: testData.region,
        phone: testData.phone,
        whatsAppPhone: testData.phone,
        birthDay: testData.birthDate,
    };
    // send a POST request to create a new customer
    try {
        const response = await fetch(`${API_URL}/customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'suresteps.session.token': token },
            body: JSON.stringify(payload),
        });
        if (response.status !== 200 && response.status !== 409)
            console.error('Failed to create a test customer. Response status: ', response.status);
    } catch (error) {
        console.error('Error creating a test customer: ', error);
    }
};

// Get the session token for the test user
const getToken = async () => {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/text' },
            body: JSON.stringify({ userName: testData.email, password: testData.password }),
        });
        if (response.status === 200)
            return await response.text(); // Get the session token
        else console.error('Unable to get session token: ', response.statusText);
    } catch (error) {
        console.error('Login Error: ', error);
    }
};

// Send a POST request with 30 steps matching the given time
const save30Steps = async (time) => {
    // create the payload for the request
    const endTime = Date.now();
    const payload = {
        customer: testData.email,
        startTime: endTime - time * 30, // backdate the start time
        stepPoints: Array(30).fill(time),
        stopTime: endTime,
        testTime: time * 30,
        deviceId: '000',
        totalSteps: 30,
    };
    // send a POST request to save step data
    return await fetch(`${API_URL}/rapidsteptest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/text', 'suresteps.session.token': token },
        body: JSON.stringify(payload),
    });
};
