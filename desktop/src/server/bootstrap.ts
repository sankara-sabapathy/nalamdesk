import * as dotenv from 'dotenv';
import { loadDevelopmentEnv } from '../shared/load-env';

loadDevelopmentEnv();
dotenv.config();

void import('./index.js');
