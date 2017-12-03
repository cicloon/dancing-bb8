import { Observable } from 'rxjs';

export const getDevice$ = (
  click$: Observable<Boolean>,
  serviceUUIds: BluetoothServiceUUID[]  ): Observable<BluetoothDevice> => (
  click$.mergeMap((clicked: Boolean): Observable<BluetoothDevice> => (

    Observable.fromPromise(navigator.bluetooth.requestDevice({
      filters: serviceUUIds.map((serviceUUID) => ({services: [serviceUUID]}) )
    }))

   ))
);
