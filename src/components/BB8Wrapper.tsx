import * as React from 'react';
import { BB8 } from '../lib/BB8';

interface PropsType {
  device?: BluetoothDevice;
  serviceUUIDS?: BluetoothServiceUUID[];
}

export class BB8Wrapper extends React.Component<PropsType> {
  state = { connected: false };
  private bb8?: BB8;

  constructor(props: PropsType) {
    super(props);
    this.initBb8(props);
  }

  componentWillReceiveProps(nextProps: PropsType) {
    if (!this.bb8) {
      this.initBb8(nextProps);
    }
  }

  connect() {
    if (this.bb8) {
      this.bb8.connect().subscribe(() => {
        this.setState({ connected: true });
      });
    }
  }

  initBb8(props: PropsType) {
    if (props.device && props.serviceUUIDS) {
      this.bb8 = new BB8(props.device, props.serviceUUIDS);
      this.connect();
    }
  }

  setColor(r: number, g: number, b: number) {
    if (this.bb8) {
      this.bb8.setColor(r, g, b);
    }
  }

  renderControls() {
    return (
      <div>
        <button onClick={() => this.setColor(255, 0, 0)}>Turn red</button>
        <button onClick={() => this.setColor(0, 255, 0)}>Turn green</button>
        <button onClick={() => this.setColor(0, 0, 255)}>Turn blue</button>
      </div>
    );
  }

  render() {
    const { connected } = this.state;

    if (!connected) {
      return <p> Waking up bb8 </p>;
    }
    return this.renderControls();
  }
}

export default BB8Wrapper;
