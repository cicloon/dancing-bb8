import { Observable } from 'rxjs';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

const controlCharacteristicId = '22bb746f-2ba1-7554-2d6f-726568705327';
const antiDosCharacteristicId = '22bb746f-2bbd-7554-2d6f-726568705327';
const txPowerCharacteristicId = '22bb746f-2bb2-7554-2d6f-726568705327';
const wakeCpuCharacteristicId = '22bb746f-2bbf-7554-2d6f-726568705327';

interface BB8$ {
  controlCharacteristic?: BluetoothRemoteGATTCharacteristic;
  radioService?: BluetoothRemoteGATTService;
  robotService?: BluetoothRemoteGATTService;
  antiDos?: BluetoothRemoteGATTCharacteristic;
  txPower?: BluetoothRemoteGATTCharacteristic;
  wakeCpu?: BluetoothRemoteGATTCharacteristic;
  gattServer?: BluetoothRemoteGATTServer;
}

interface Command {
  did: number;
  cid: number;
  data: Uint8Array;
}

export class BB8 {
  busy: Boolean = false;
  connect$: Observable<BB8$>;
  command$: Subject<Command>;
  connected: Boolean = false;
  started: Boolean = false;

  constructor(bb8Device: BluetoothDevice, services: BluetoothServiceUUID[] ) {
    this.connect$ = this.getConnectStream(bb8Device, services);
    this.getCommandStream();
  }

  connect() {
    this.connect$.subscribe((connection) => {
      // tslint:disable-next-line no-console
      console.log('connecting');
      this.connected = true;

      Observable.combineLatest(
        connection.antiDos ?
          connection.antiDos.writeValue(new Uint8Array('011i3'.split('').map(c => c.charCodeAt(0))))
          : Observable.empty() ,
        connection.txPower ?
          connection.txPower.writeValue(new Uint8Array([0x07]))
          : Observable.empty() ,
        connection.wakeCpu ?
          connection.wakeCpu.writeValue(new Uint8Array([0x01]))
          : Observable.empty() ,
      ).subscribe(() => {
        // tslint:disable-next-line no-console
        console.log('bb8 started');
        this.started = true;
      });
    } );
    return this.connect$;
  }

  setColor(r: number, g: number, b: number) {
    // tslint:disable-next-line
    console.log('setting color:', r, g, b);
    const did = 0x02; // Virtual device ID
    const cid = 0x20; // Set RGB LED Output command
    // Color command data: red, green, blue, flag
    const data = new Uint8Array([r, g, b, 0]);
    this.sendCommand({did, cid, data});
  }

  private sendCommand(command: Command) {
    const subject = this.command$;
    subject.next(command);
  }

  private getConnectStream(bb8Device: BluetoothDevice, services: BluetoothServiceUUID[]): Observable<BB8$> {
    const connect$ = new BehaviorSubject({});
    const observable = connect$ as Observable<BB8$>;
    return observable
      .mergeMap(() => (Observable.from(bb8Device.gatt!.connect()))  )
      .map((server) => ({server}))
      .concatMap(
        (connecting) => (connecting.server.getPrimaryService(services[0])),
        (connecting, radioService) => ({...connecting, radioService}))
      .concatMap(
        (connecting) => {
          const {radioService} = connecting;
          return Observable.forkJoin(
            radioService.getCharacteristic(txPowerCharacteristicId),
            radioService.getCharacteristic(antiDosCharacteristicId),
            radioService.getCharacteristic(wakeCpuCharacteristicId),
            (txPower, antiDos, wakeCpu) => ({...connecting, txPower, antiDos, wakeCpu})
          );
        },
        (connecting, characteristics) => ({...connecting, ...characteristics}))
      .concatMap(
        (connecting) => (connecting.server.getPrimaryService(services[1])),
        (connecting, robotService) => ({...connecting, robotService}))
      .concatMap(
        (connecting) => (connecting.robotService.getCharacteristic(controlCharacteristicId)),
        (connecting, controlCharacteristic) => ({...connecting, controlCharacteristic}));
  }

  private getCommandStream() {
    interface CommandControl {
      sequence?: number;
      command?: Command;
      control?: BluetoothRemoteGATTCharacteristic;
    }

    this.command$ = new Subject();
    // tslint:disable-next-line
    this.command$.subscribe(() => {console.log('called subject'); } );

    this.command$
      // tslint:disable-next-line
      .do((v) => {console.log('before concat', v); } )
      .combineLatest(
        this.connect$,
        (command?: Command, connection?: BB8$) => (
          {command, control: connection!.controlCharacteristic}
        )
      )
      // tslint:disable-next-line
      .do((v) => {console.log('after concat', v); } )
      .scan(
        (acc: CommandControl, commandControl: CommandControl) => (
          { sequence: acc.sequence, control: commandControl.control, command: commandControl.command }  ),
        { sequence: 0, command: undefined, control: undefined }  )
      // tslint:disable-next-line
      .do((v) => {console.log('after scan', v); } )
      .mergeMap((commandControl: CommandControl ) => {
        const { did, cid, data }: Command = commandControl.command!;
        // tslint:disable-next-line no-bitwise
        const seq = commandControl.sequence! & 0xFF;
        let sop2 = 0xfc;
        // tslint:disable-next-line no-bitwise
        sop2 |= 1; // Answer
        // tslint:disable-next-line no-bitwise
        sop2 |= 2; // Reset timeout

        // Data length
        const dlen = data.byteLength + 1;
        const sum = data.reduce((a: number, b: number) => (a + b));
        // Checksum
        // tslint:disable-next-line no-bitwise
        const chk = ((sum + did + cid + seq + dlen) & 0xFF) ^ 0xFF;
        const checksum = new Uint8Array([chk]);
        const packets = new Uint8Array([0xFF, sop2, did, cid, seq, dlen]);
        const array = new Uint8Array(packets.byteLength + data.byteLength + checksum.byteLength);
        array.set(packets, 0);
        array.set(data, packets.byteLength);
        array.set(checksum, packets.byteLength + data.byteLength);
        // tslint:disable-next-line
        console.log('sending: ', array);
        return Observable.from(commandControl.control!.writeValue(array));
      }).subscribe(() => (true));
  }
}
