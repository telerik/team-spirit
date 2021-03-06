import { Injectable } from '@angular/core';
import Everlive from 'everlive-sdk';
import { Item } from '../../node_modules/everlive-sdk/dist/declarations/everlive/interfaces/Item';
import { RequestOptions } from '../../node_modules/everlive-sdk/dist/declarations/everlive/interfaces/RequestOptions';

import * as nsPlatform from 'platform';
import * as dialogs from 'ui/dialogs';

import { utilities, constants } from '../shared';

@Injectable()
export class EverliveProvider {
    private _everlive: Everlive;

    constructor() {
        this._everlive = new Everlive({
            appId: constants.appId,
            authentication: {
                persist: true
            },
            scheme: 'https'
        });
    }

    get get(): Everlive {
        return this._everlive;
    }

    getData<T extends Item>(collectionName: string) {
        return this._everlive.data<T>(collectionName);
    }

    getNewQuery() {
        return new Everlive.Query();
    }

    getNewAggregateQuery() {
        return new Everlive.AggregateQuery();
    }

    makeRequest(options: RequestOptions) {
        return this._everlive.request(options).send();
    }
}
