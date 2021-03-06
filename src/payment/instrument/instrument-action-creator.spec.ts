import { createRequestSender, Response } from '@bigcommerce/request-sender';
import { Observable } from 'rxjs';

import { Address } from '../../address';
import { createCheckoutStore, CheckoutStore, CheckoutStoreState } from '../../checkout';
import { getCheckoutStoreState } from '../../checkout/checkouts.mock';
import { getErrorResponse, getResponse } from '../../common/http-request/responses.mock';
import { getShippingAddress } from '../../shipping/shipping-addresses.mock';

import { VaultAccessToken } from './instrument';
import InstrumentActionCreator from './instrument-action-creator';
import { InstrumentActionType } from './instrument-actions';
import InstrumentRequestSender from './instrument-request-sender';
import { InstrumentsResponseBody } from './instrument-response-body';
import {
    deleteInstrumentResponseBody,
    getInstrumentsMeta,
    getInstrumentsState,
    getLoadInstrumentsResponseBody,
    getVaultAccessToken,
} from './instrument.mock';

describe('InstrumentActionCreator', () => {
    const bigpayClient: any = {};
    let instrumentActionCreator: InstrumentActionCreator;
    let instrumentRequestSender: InstrumentRequestSender;
    let vaultAccessTokenResponse: Response<VaultAccessToken>;
    let loadInstrumentsResponse: Response<InstrumentsResponseBody>;
    let deleteInstrumentResponse: Response<InstrumentsResponseBody>;
    let errorResponse: Response;
    let state: CheckoutStoreState;
    let store: CheckoutStore;
    let storeId: string;
    let customerId: number;
    let instrumentId: string;
    let shippingAddress: Address;
    let vaultAccessExpiry: number;
    let vaultAccessToken: string;

    beforeEach(() => {
        instrumentRequestSender = new InstrumentRequestSender(bigpayClient, createRequestSender());
        errorResponse = getErrorResponse();
        vaultAccessTokenResponse = getResponse(getVaultAccessToken());
        loadInstrumentsResponse = getResponse(getLoadInstrumentsResponseBody());
        deleteInstrumentResponse = getResponse(deleteInstrumentResponseBody());

        jest.spyOn(instrumentRequestSender, 'getVaultAccessToken').mockResolvedValue(vaultAccessTokenResponse);
        jest.spyOn(instrumentRequestSender, 'loadInstruments').mockResolvedValue(loadInstrumentsResponse);
        jest.spyOn(instrumentRequestSender, 'deleteInstrument').mockResolvedValue(deleteInstrumentResponse);

        instrumentActionCreator = new InstrumentActionCreator(instrumentRequestSender);

        state = getCheckoutStoreState();
        store = createCheckoutStore(state);

        // tslint:disable-next-line:no-non-null-assertion
        storeId = state.config.data!.storeConfig.storeProfile.storeId;
        // tslint:disable-next-line:no-non-null-assertion
        customerId = state.cart.data!.customerId;
        shippingAddress = getShippingAddress();
        instrumentId = '123';

        const instrumentsMeta = getInstrumentsMeta();
        vaultAccessToken = instrumentsMeta.vaultAccessToken;
        vaultAccessExpiry = instrumentsMeta.vaultAccessExpiry;
    });

    describe('#loadInstruments()', () => {
        it('sends a request to get a list of instruments', async () => {
            await Observable.from(instrumentActionCreator.loadInstruments()(store))
                .toPromise();

            expect(instrumentRequestSender.getVaultAccessToken).toHaveBeenCalled();
            expect(instrumentRequestSender.loadInstruments).toHaveBeenCalledWith(
                { storeId, customerId, authToken: vaultAccessToken },
                shippingAddress
            );
        });

        it('does not send a request to get a list of instruments if valid token is supplied', async () => {
            store = createCheckoutStore({
                ...state,
                instruments: {
                    ...getInstrumentsState(),
                    meta: {
                        ...getInstrumentsMeta(),
                        vaultAccessExpiry: 1816097476098,
                    },
                },
            });

            await Observable.from(instrumentActionCreator.loadInstruments()(store))
                .toPromise();

            expect(instrumentRequestSender.getVaultAccessToken).not.toHaveBeenCalled();
            expect(instrumentRequestSender.loadInstruments).toHaveBeenCalledWith(
                { storeId, customerId, authToken: vaultAccessToken },
                shippingAddress
            );
        });

        it('emits actions if able to load instruments', async () => {
            const actions = await Observable.from(instrumentActionCreator.loadInstruments()(store))
                .toArray()
                .toPromise();

            expect(actions).toEqual([
                {
                    type: InstrumentActionType.LoadInstrumentsRequested,
                },
                {
                    type: InstrumentActionType.LoadInstrumentsSucceeded,
                    meta: { vaultAccessExpiry, vaultAccessToken },
                    payload: loadInstrumentsResponse.body,
                },
            ]);
        });

        it('emits error actions if unable to load instruments', async () => {
            jest.spyOn(instrumentRequestSender, 'loadInstruments').mockRejectedValue(errorResponse);

            const errorHandler = jest.fn(action => Observable.of(action));
            const actions = await Observable.from(instrumentActionCreator.loadInstruments()(store))
                .catch(errorHandler)
                .toArray()
                .toPromise();

            expect(errorHandler).toHaveBeenCalled();
            expect(actions).toEqual([
                { type: InstrumentActionType.LoadInstrumentsRequested },
                { type: InstrumentActionType.LoadInstrumentsFailed, payload: errorResponse, error: true },
            ]);
        });

        it('emits Missing Data Error if data is missing from the date', async () => {
            store = createCheckoutStore();

            try {
                await Observable.from(instrumentActionCreator.loadInstruments()(store))
                    .toArray()
                    .toPromise();
            } catch (e) {
                expect(e.type).toEqual('missing_data');
            }
        });
    });

    describe('#deleteInstrument()', () => {
        it('deletes an instrument', async () => {
            await Observable.from(instrumentActionCreator.deleteInstrument(instrumentId)(store))
                .toPromise();

            expect(instrumentRequestSender.getVaultAccessToken).toHaveBeenCalled();
            expect(instrumentRequestSender.deleteInstrument).toHaveBeenCalledWith(
                {
                    storeId,
                    customerId,
                    authToken: vaultAccessToken,
                },
                instrumentId
            );
        });

        it('does not send a request to get a list of instruments if valid token is supplied', async () => {
            store = createCheckoutStore({
                ...state,
                instruments: {
                    ...getInstrumentsState(),
                    meta: {
                        ...getInstrumentsMeta(),
                        vaultAccessExpiry: 1816097476098,
                    },
                },
            });

            await Observable.from(instrumentActionCreator.deleteInstrument(instrumentId)(store))
                .toPromise();

            expect(instrumentRequestSender.getVaultAccessToken).not.toHaveBeenCalled();
            expect(instrumentRequestSender.deleteInstrument).toHaveBeenCalledWith(
                {
                    storeId,
                    customerId,
                    authToken: vaultAccessToken,
                },
                instrumentId
            );
        });

        it('emits actions if able to delete an instrument', async () => {
            const actions = await Observable.from(instrumentActionCreator.deleteInstrument(instrumentId)(store))
                .toArray()
                .toPromise();

            expect(actions).toEqual([
                {
                    type: InstrumentActionType.DeleteInstrumentRequested,
                    meta: { instrumentId },
                },
                {
                    type: InstrumentActionType.DeleteInstrumentSucceeded,
                    meta: { instrumentId, vaultAccessExpiry, vaultAccessToken },
                    payload: deleteInstrumentResponse.body,
                },
            ]);
        });

        it('emits error actions if unable to delete an instrument', async () => {
            jest.spyOn(instrumentRequestSender, 'deleteInstrument').mockRejectedValue(errorResponse);

            const errorHandler = jest.fn(action => Observable.of(action));
            const actions = await Observable.from(instrumentActionCreator.deleteInstrument(instrumentId)(store))
                .catch(errorHandler)
                .toArray()
                .toPromise();

            expect(errorHandler).toHaveBeenCalled();
            expect(actions).toEqual([
                {
                    type: InstrumentActionType.DeleteInstrumentRequested,
                    meta: { instrumentId },
                },
                {
                    type: InstrumentActionType.DeleteInstrumentFailed,
                    meta: { instrumentId },
                    payload: errorResponse,
                    error: true,
                },
            ]);
        });

        it('emits Missing Data Error if data is missing from the date', async () => {
            store = createCheckoutStore({});

            try {
                await Observable.from(instrumentActionCreator.deleteInstrument('')(store))
                    .toArray()
                    .toPromise();
            } catch (e) {
                expect(e.type).toEqual('missing_data');
            }
        });
    });
});
