import {defineConfig} from '@playwright/test';
try{process.loadEnvFile('.env');}catch{/* externally provided environment */}
export default defineConfig({testDir:'tests/browser',timeout:45000,use:{baseURL:process.env.TEST_BASE_URL??'http://127.0.0.1:3000',headless:true},reporter:'list'});
