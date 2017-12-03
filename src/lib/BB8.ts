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
  label?: string;
}

interface CommandResponse extends Command {
  timestamp: number;
  sequence: number;
}

export class BB8 {
  connected: Boolean = false;
  started: Boolean = false;
  private connect$: Observable<BB8$>;
  private command$: Observable<CommandResponse>;
  private commandSubject: Subject<Command>;

  constructor(bb8Device: BluetoothDevice, services: BluetoothServiceUUID[] ) {
    this.connect$ = this.getConnectStream(bb8Device, services);
    this.commandSubject = new Subject();
    this.command$ = this.getCommandStream();
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
        this.command$.subscribe(this.logCommandResponse);
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
    this.sendCommand({did, cid, data, label: 'setColor'});
  }

  private sendCommand(command: Command) {
    this.commandSubject.next(command);
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

  private getCommandStream(): Observable<CommandResponse> {
    interface CommandControl {
      sequence?: number;
      command?: Command;
      control?: BluetoothRemoteGATTCharacteristic;
    }

    return this.commandSubject
      .combineLatest(
        this.connect$,
        (command?: Command, connection?: BB8$) => (
          {command, control: connection!.controlCharacteristic}
        )
      )
      .scan(
        (acc: CommandControl, commandControl: CommandControl) => (
          { sequence: acc.sequence! + 1, control: commandControl.control, command: commandControl.command }  ),
        { sequence: 0, command: undefined, control: undefined }  )
      .mergeMap((commandControl: CommandControl ) => {
        const { did, cid, data }: Command = commandControl.command!;
        const seq = commandControl.sequence! & 0xFF;
        let sop2 = 0xfc;
        sop2 |= 1; // Answer
        sop2 |= 2; // Reset timeout
        // Data length
        const dlen = data.byteLength + 1;
        // Checksum
        const sum = data.reduce((a: number, b: number) => (a + b));
        const chk = ((sum + did + cid + seq + dlen) & 0xFF) ^ 0xFF;
        const checksum = new Uint8Array([chk]);

        const packets = new Uint8Array([0xFF, sop2, did, cid, seq, dlen]);
        const array = new Uint8Array(packets.byteLength + data.byteLength + checksum.byteLength);
        array.set(packets, 0);
        array.set(data, packets.byteLength);
        array.set(checksum, packets.byteLength + data.byteLength);

        const timestamp = Date.now();
        console.debug('Command sent:', commandControl.sequence, commandControl.command!.label);
        return Observable.of(array)
          .bufferWhen(() => Observable.interval(20))
          .flatMap(Observable.of)
          .filter(Array.isArray)
          .mergeMap(
            (toSentArray) => {
                return Observable.from(commandControl.control!.writeValue(toSentArray[0].buffer) );
            })
          .map((): CommandResponse => {
            const command = commandControl.command!;
            const sequence = commandControl.sequence!;
            return { ...command, timestamp, sequence };
          });
      });
  }

  private logCommandResponse(commandResponse: CommandResponse) {
    const now = Date.now();
    console.debug('Command performed:',
                  commandResponse.sequence,
                  commandResponse.label,
    );
    console.debug('  elapsed time:',
                  now - commandResponse.timestamp
    );
  }

}
