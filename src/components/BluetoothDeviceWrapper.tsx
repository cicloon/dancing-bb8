import * as React from 'react';
import { Subject, Observable } from 'rxjs';
import autobindDecorator from 'autobind-decorator';
import { getDevice$ } from '../lib/bluetooth';
import { BB8 } from '../lib/BB8';

interface StateInterface {
  device?: BluetoothDevice;
}

interface PropsType {
  serviceUUIDS: BluetoothServiceUUID[];
}

class BluetoothDeviceWrapper extends React.Component<PropsType> {
  device$: Observable<BluetoothDevice>;
  click$: Subject<Boolean>;
  setColor$$: Subject<Boolean>;

  constructor(props: { serviceUUIDS: BluetoothServiceUUID[] }) {
    super(props);
    const state: StateInterface = {};
    this.state = state;
    this.click$ = new Subject();
    this.device$ = getDevice$(this.click$, props.serviceUUIDS);
  }

  componentDidMount() {
    this.device$.subscribe((device: BluetoothDevice) =>
      this.setState({ device })
    );
  }

  renderDevice() {
    const { device }: { device?: BluetoothDevice } = this.state;
    const { serviceUUIDS } = this.props;

    if (device) {
      const bb8 = new BB8(device, serviceUUIDS);
      bb8.connect();
      setTimeout(() => bb8.setColor(255, 0, 0), 3000);
      setTimeout(() => bb8.setColor(255, 255, 0), 4000);
      setTimeout(() => bb8.setColor(255, 255, 255), 5000);
    }

    return (
      device && (
        <div>
          <p> Connected to: </p>
          <span key={device.name}> {device.name} </span>
        </div>
      )
    );
  }

  @autobindDecorator
  requestBluetooth() {
    this.click$.next(true);
  }

  render() {
    const { device }: StateInterface = this.state;
    return (
      <div>
        {!device && (
          <a onClick={this.requestBluetooth}> Request bluetooth devices </a>
        )}
        {this.renderDevice()}
      </div>
    );
  }
}

export default BluetoothDeviceWrapper;
