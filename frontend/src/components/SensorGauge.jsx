import PhScaleBar from './PhScaleBar';
import WaterTankGauge from './WaterTankGauge';
import ThermometerGauge from './ThermometerGauge';
import OxygenBubblesGauge from './OxygenBubblesGauge';
import HumidityVaporGauge from './HumidityVaporGauge';
import NitratesGauge from './NitratesGauge';
import Co2Gauge from './Co2Gauge';
import ConductivityGauge from './ConductivityGauge';
import TurbidityGauge from './TurbidityGauge';
import AmbientTempGauge from './AmbientTempGauge';
import PressureGauge from './PressureGauge';
import { SENSOR_META } from '../data/defaults';
import { formatSensorReading } from '../data/normalizer';

export default function SensorGauge({
  sensorKey,
  reading,
  label,
  delay = 0,
  status = null,
  inactive = false,
}) {
  const meta = SENSOR_META[sensorKey];
  const resolvedLabel = label ?? meta?.label;
  const common = { label: resolvedLabel, delay, status, inactive };

  const percentProps = {
    ...common,
    value: reading?.percent ?? 0,
    reading: reading ? formatSensorReading(reading) : null,
  };

  switch (sensorKey) {
    case 'ph':
      return (
        <PhScaleBar
          {...common}
          value={reading?.value ?? 0}
          min={meta.min}
          max={meta.max}
        />
      );
    case 'nivelAgua':
      return <WaterTankGauge {...percentProps} />;
    case 'temperatura':
      return (
        <ThermometerGauge
          {...percentProps}
          min={meta.min}
          max={meta.max}
        />
      );
    case 'oxigeno':
      return <OxygenBubblesGauge {...percentProps} />;
    case 'humedad':
      return <HumidityVaporGauge {...percentProps} />;
    case 'nitratos':
      return <NitratesGauge {...percentProps} />;
    case 'co2':
      return <Co2Gauge {...percentProps} />;
    case 'electroconductividad':
      return <ConductivityGauge {...percentProps} />;
    case 'turbiedad':
      return <TurbidityGauge {...percentProps} />;
    case 'temperaturaAmbiente':
      return (
        <AmbientTempGauge
          {...percentProps}
          min={meta.min}
          max={meta.max}
        />
      );
    case 'presion':
      return <PressureGauge {...percentProps} />;
    default:
      return null;
  }
}
