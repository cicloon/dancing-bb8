import * as React from 'react';
import { Subject, Observable } from 'rxjs';
import autobindDecorator from 'autobind-decorator';
import { getDevice$ } from '../lib/bluetooth';

interface StateInterface {
  device?: BluetoothDevice;
}

interface PropsType {
  serviceUUIDS: BluetoothServiceUUID[];
  children: JSX.Element;
}

interface ChildrenPropsType {
  device: BluetoothDevice;
  serviceUUIDS: BluetoothServiceUUID[];
}

class BluetoothDeviceWrapper extends React.Component<PropsType> {
  device$: Observable<BluetoothDevice>;
  click$: Subject<Boolean>;
  setColor$$: Subject<Boolean>;

  constructor(props: PropsType) {
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
    const { serviceUUIDS, children } = this.props;

    return (
      device && (
        <div>
          <p> Connected to: </p>
          <span key={device.name}> {device.name} </span>
          {React.Children.map(children, (child, index) =>
            React.cloneElement(child as React.ReactElement<ChildrenPropsType>, {
              device,
              serviceUUIDS
            })
          )}
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
