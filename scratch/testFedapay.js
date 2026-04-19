import { FedaPay, Transaction } from 'fedapay';

FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY || 'sk_sandbox_...put here'); // Wait, I don't have the key! We can test directly using the user's environment in Vercel.
