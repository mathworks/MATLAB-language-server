// Copyright 2024 The MathWorks, Inc.

import 'express-session';

declare module 'express-session' {
    interface SessionData {
        'mwi-auth-token': string;
    }
}