import { h, Component } from 'preact';
const geomicons = require('geomicons-open');

geomicons['share'] = "m 24.000001,20 c -1.6,0 -2.8,0.599999 -4.000001,1.6 L 13.6,18 C 13.8,17.4 14,16.6 14,16 14,15.4 13.8,14.6 13.6,14 L 20,10.4 C 21.200001,11.399999 22.400001,12 24.000001,12 27.400001,12 30,9.3999991 30,5.9999993 30,2.5999995 27.400001,0 24.000001,0 20.6,0 18,2.5999995 18,5.9999993 c 0,0.4000011 0,0.5999998 0,1.0000008 L 11,10.799999 C 10.2,10.4 9.2000001,9.9999989 8,9.9999989 4.8,9.9999989 2,12.6 2,16 l 0,0 c 0,3.199999 2.8,5.999999 6,5.999999 1.2000001,0 2.2,-0.399999 3,-0.8 L 18,25 c 0,0.399999 0,0.6 0,1.000001 C 18,29.4 20.6,32 24.000001,32 27.400001,32 30,29.4 30,26.000001 30,22.599999 27.400001,20 24.000001,20 Z";

export default class Icon extends Component {
  render() {
    const { name, size } = this.props;

    if (!name || name.length <= 0) {
      return;
    }

    if (!geomicons[name]) {
      console.error('No icon named:', name);
    }

    const style = {
      width: '1em',
      fill: 'currentcolor',
      transform: 'translateY(.125em)'
    };

    return (
      <svg viewBox="0 0 32 32" style={style}>
        <title>{name} icon</title>
        <path d={geomicons[name]} />
      </svg>
    );
  }
}
