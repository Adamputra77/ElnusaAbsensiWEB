import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const defaultMarkerIcon = new (L as any).Icon.Default();

function GoogleMapsButton({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=ChIJF85UPOLkaS4RQVPWcte1yQU`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95"
    >
      Buka di Google Maps
    </a>
  );
}

function MapAttributionControl() {
  useMapEvents({
    click(e: any) {
      console.log('Map clicked:', e.latlng);
    }
  });
  return null;
}

export function WarehouseMap({
  center,
  zoom = 16,
  pob = 0,
  label = "Warehouse Elnusa BSD",
  address = "Jl. Tekno Widya No.21, Setu, Tangerang Selatan"
}: {
  center: [number, number];
  zoom?: number;
  pob: number;
  label: string;
  address: string;
}) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800/50 bg-slate-950">
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={true}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <Marker position={center} icon={defaultMarkerIcon}>
          <Popup
            className="leaflet-popup-dark"
            offset={[0, -20]}
            autoClose={false}
            closeOnClick={false}
          >
            <div className="min-w-[220px] p-2 text-center">
              <p className="font-black text-white text-sm mb-1">{label}</p>
              <p className="text-[11px] text-slate-400 mb-2">{address}</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span className="text-[11px] font-bold text-green-400">SYS ONLINE</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 mb-2 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">POB AKTIF</p>
                <p className="text-2xl font-mono font-black text-cyan-400">{pob}</p>
              </div>
              <GoogleMapsButton lat={-6.3006} lng={106.6578} />
            </div>
          </Popup>
        </Marker>
        <MapAttributionControl />
      </MapContainer>
      <div className="absolute bottom-2 right-2 z-10 bg-slate-950/90 backdrop-blur-sm rounded-xl p-2 border border-slate-800/50 text-[10px] font-mono text-slate-400">
        📍 Warehouse Elnusa BSD
      </div>
    </div>
  );
}
