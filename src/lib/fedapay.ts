import { FedaPay } from 'fedapay';

const secretKey = process.env.FEDAPAY_SECRET_KEY;
const environment = process.env.FEDAPAY_ENVIRONMENT || 'live';

if (!secretKey) {
    console.error('FEDAPAY_SECRET_KEY is missing in your environment variables.');
}

FedaPay.setApiKey(secretKey || '');
FedaPay.setEnvironment(environment);

export { FedaPay };
