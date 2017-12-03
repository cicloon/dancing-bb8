import * as React from 'react';
import './App.css';
import BluetoothDeviceWrapper from './components/BluetoothDeviceWrapper';
import { BB8Wrapper } from './components/BB8Wrapper';

const serviceUUIDS = [
  '22bb746f-2bb0-7554-2d6f-726568705327',
  '22bb746f-2ba0-7554-2d6f-726568705327'
];

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <p className="App-intro">BB8 dancing controller</p>
        <BluetoothDeviceWrapper serviceUUIDS={serviceUUIDS}>
          <BB8Wrapper />
        </BluetoothDeviceWrapper>
      </div>
    );
  }
}

export default App;
