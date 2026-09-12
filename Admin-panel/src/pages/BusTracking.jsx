import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Bus,
  Phone,
  MapPin,
  User,
  Users,
  Navigation,
  Search,
  X,
  Save,
  Pencil,
  Camera,
  Video,
  Gauge,
  Headset,
  Radio,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  statusTone,
  StatCard,
} from "../components/UI";
import { api } from "../lib/api";
const initialRoutes = [];
const transportDesk = { name: "", phone: "" };

const STATUS_FILTERS = ["All", "On Route", "Delayed", "Not Started", "Arrived"];
const SCHOOL_LOCATION = { lat: 23.2599, lng: 77.4126 };

const CAMERA_POSITIONS = [
  { label: "Front Door", pos: "bottom-[6px] left-[8px]" },
  { label: "Driver Cabin", pos: "top-[50%] left-[8px] -translate-y-1/2" },
  { label: "Aisle / Mid", pos: "top-[50%] right-[8px] -translate-y-1/2" },
  { label: "Back Exit", pos: "bottom-[6px] right-[8px]" },
];

// ---- Marker helpers ----------------------------------------------------------
function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `
      <div class="bus-marker" style="--marker-color:${color}">
        <div class="bus-marker-dot"><span>🚌</span></div>
        <div class="bus-marker-pulse"></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function makeSchoolIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div class="school-marker"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1-.553 1.895H.106a1 1 0 0 1-.553-1.895L3 10"/><path d="M5 17V9L12 4l7 5v8"/><path d="M9 17v-3.5a1.5 1.5 0 0 1 3 0V17"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const STATUS_COLOR = {
  "On Route": "#3F8F5F",
  Delayed: "#D65A4A",
  "Not Started": "#94A3B8",
  Arrived: "#16213E",
};

// ---- Live tracking simulation -----------------------------------------------
function useLivePositions(routes) {
  const [positions, setPositions] = useState(() =>
    Object.fromEntries(routes.map((r) => [r.id, { lat: r.lat, lng: r.lng }])),
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) => {
        const next = { ...prev };
        const now = Date.now();
        routes.forEach((r) => {
          if (r.status !== "On Route" && r.status !== "Delayed") return;
          const wp =
            r.waypoints && r.waypoints.length
              ? r.waypoints
              : [
                  [r.lat, r.lng],
                  [SCHOOL_LOCATION.lat, SCHOOL_LOCATION.lng],
                ];
          const cycle = 20000;
          const t = (now % cycle) / cycle;
          const totalSeg = wp.length - 1;
          const seg = Math.min(Math.floor(t * totalSeg), totalSeg - 1);
          const local = Math.min(t * totalSeg - seg, 1);
          const a = wp[seg];
          const b = wp[seg + 1];
          const lat = a[0] + (b[0] - a[0]) * local;
          const lng = a[1] + (b[1] - a[1]) * local;
          next[r.id] = { lat, lng };
          // ETA / speed jitter for realism
          const s = Math.max(
            0,
            (r.status === "Delayed" ? 12 : 18) + Math.random() * 20,
          );
          next[`${r.id}_speed`] = Math.round(s);
        });
        return next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [routes]);
  return positions;
}

function FleetMap({ routes, positions, selected, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const pathRefs = useRef({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [SCHOOL_LOCATION.lat, SCHOOL_LOCATION.lng],
      zoom: 12,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    L.marker([SCHOOL_LOCATION.lat, SCHOOL_LOCATION.lng], {
      icon: makeSchoolIcon(),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindTooltip("Brightwood International School", {
        direction: "top",
        offset: [0, -20],
      });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      pathRefs.current = {};
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const latlngs = routes.flatMap((r) =>
      r.waypoints && r.waypoints.length ? r.waypoints : [[r.lat, r.lng]],
    );
    if (latlngs.length)
      mapRef.current.fitBounds(latlngs, { padding: [50, 50] });
  }, [routes]);

  useEffect(() => {
    if (!mapRef.current) return;
    routes.forEach((r) => {
      const latlngs = (
        r.waypoints && r.waypoints.length ? r.waypoints : [[r.lat, r.lng]]
      ).map((p) => [p[0], p[1]]);
      const color = STATUS_COLOR[r.status] || "#94A3B8";
      if (pathRefs.current[r.id]) {
        pathRefs.current[r.id].setLatLngs(latlngs);
        pathRefs.current[r.id].setStyle({
          color,
          dashArray: r.status === "Delayed" ? "6 6" : null,
        });
      } else {
        pathRefs.current[r.id] = L.polyline(latlngs, {
          color,
          weight: 3,
          opacity: 0.6,
          dashArray: r.status === "Delayed" ? "6 6" : null,
        }).addTo(mapRef.current);
      }
    });
  }, [routes]);

  useEffect(() => {
    if (!mapRef.current) return;
    routes.forEach((r) => {
      const pos = positions[r.id] || { lat: r.lat, lng: r.lng };
      if (markersRef.current[r.id]) {
        markersRef.current[r.id].setLatLng([pos.lat, pos.lng]);
      } else {
        const marker = L.marker([pos.lat, pos.lng], {
          icon: makeIcon(STATUS_COLOR[r.status] || "#94A3B8"),
          riseOnHover: true,
        });
        marker.bindTooltip(`${r.id} · ${r.route.split(" — ")[0]}`, {
          direction: "top",
          offset: [0, -22],
        });
        marker.on("click", () => onSelect(r));
        marker.addTo(mapRef.current);
        markersRef.current[r.id] = marker;
      }
      const m = markersRef.current[r.id];
      m.setIcon(makeIcon(STATUS_COLOR[r.status] || "#94A3B8"));
      const el = m.getElement();
      if (el) {
        const dot = el.querySelector(".bus-marker");
        if (dot)
          dot.classList.toggle("is-selected", selected && r.id === selected.id);
      }
    });
  }, [routes, positions, selected, onSelect]);

  // Map legend
  return (
    <div className="relative flex-1 min-h-[520px]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] font-semibold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <Radio size={12} className="text-success" /> LIVE
        </span>{" "}
        · Bhopal Fleet · GPS refresh 150ms
      </div>
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] space-y-1">
        {Object.entries({
          "On Route": "#3F8F5F",
          Delayed: "#D65A4A",
          "Not Started": "#94A3B8",
          School: "#16213E",
        }).map(([label, color]) => (
          <div key={label} className="flex items-center gap-2 text-slate-text">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ background: color }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Contact card ------------------------------------------------------------
function ContactRow({ icon: Icon, label, name, phone, highlighted }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${highlighted ? "bg-amber/15 text-amber-dark" : "bg-paper text-slate-text/70"}`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-text/60">{label}</p>
        <p className="text-[13px] font-semibold text-ink truncate">{name}</p>
      </div>
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-[11.5px] font-semibold hover:bg-success/20 transition-colors"
        title={`Call ${phone}`}
      >
        <Phone size={12} /> {phone}
      </a>
    </div>
  );
}

function CctvGrid({ bus, onOpen }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: bus.cctvCount || 4 })
        .slice(0, 6)
        .map((_, i) => {
          const cam = CAMERA_POSITIONS[i % CAMERA_POSITIONS.length];
          return (
            <button
              key={i}
              onClick={() => onOpen(bus, i, cam.label)}
              className="relative aspect-[16/10] rounded-lg overflow-hidden bg-ink group text-left"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #1F2E52 0%, #0F172E 60%)",
              }}
            >
              {/* simulated scene */}
              <div className="absolute inset-0 opacity-40">
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-white/10" />
                <div className="absolute left-0 right-0 top-[62%] h-[1px] bg-white/5" />
              </div>
              {/* fake moving vehicle silhouettes */}
              <div className="cctv-scene absolute bottom-0 left-0 right-0 h-1/3">
                <span
                  className="cctv-car"
                  style={{ animationDelay: `${i * 0.4}s` }}
                />
                <span
                  className="cctv-car cctv-car-2"
                  style={{ animationDelay: `${i * 0.7}s` }}
                />
              </div>
              <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
                <span className="cctv-rec text-[9px] font-bold text-white/90 flex items-center gap-1">
                  <span className="rec-dot" /> LIVE
                </span>
              </div>
              <div className="absolute left-1.5 bottom-1 text-[9px] font-semibold text-white/80 bg-black/30 rounded px-1 py-0.5">
                CAM {String(i + 1).padStart(2, "0")} · {cam.label}
              </div>
            </button>
          );
        })}
    </div>
  );
}

export default function BusTracking() {
  const [routes, setRoutes] = useState(initialRoutes);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [cctvBus, setCctvBus] = useState(null);
  const [cctvCam, setCctvCam] = useState(0);

  useEffect(() => {
    api.transport
      .list()
      .then(({ data }) => {
        const loadedRoutes = (data || []).map((route) => ({
          ...route,
          id: route.routeNo || route._id,
          route:
            route.stops?.map((stop) => stop.name).join(" — ") ||
            "Route details unavailable",
          status: route.currentLocation ? "On Route" : "Not Started",
          lat: route.currentLocation?.lat || SCHOOL_LOCATION.lat,
          lng: route.currentLocation?.lng || SCHOOL_LOCATION.lng,
          occupied: route.assignedStudents?.length || 0,
          capacity: "—",
          eta: route.currentLocation ? "Live" : "—",
          driver: route.driverName || "Driver not assigned",
          driverPhone: route.driverContact || "—",
          conductor: "Not assigned",
          conductorPhone: "—",
          cctvCount: 4,
        }));
        setRoutes(loadedRoutes);
        setSelected(loadedRoutes[0] || null);
        setForm(loadedRoutes[0] || {});
      })
      .catch(() => {});
  }, []);
  const positions = useLivePositions(routes);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return routes.filter((b) => {
      const matchStatus = statusFilter === "All" || b.status === statusFilter;
      const matchQuery =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.route.toLowerCase().includes(q) ||
        b.driver.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [routes, query, statusFilter]);

  const stats = useMemo(() => {
    const active = routes.filter(
      (b) => b.status !== "Not Started" && b.status !== "Arrived",
    ).length;
    const onboard = routes.reduce((a, b) => a + b.occupied, 0);
    const onTime = routes.filter((b) => b.status === "On Route").length;
    const delayed = routes.filter((b) => b.status === "Delayed").length;
    return { active, onboard, onTime, delayed };
  }, [routes]);

  const speedOf = (r) =>
    positions[`${r.id}_speed`] !== undefined
      ? positions[`${r.id}_speed`]
      : r.speed;

  const openEdit = (b) => {
    setSelected(b);
    setForm({ ...b });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = () => {
    setRoutes((prev) =>
      prev.map((b) => (b.id === form.id ? { ...b, ...form } : b)),
    );
    setSelected(form);
    setShowModal(false);
  };

  const activeBus = selected;

  if (!activeBus) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Operations · Transport"
          title="Live Fleet Tracking"
          description="No transport routes are available yet. Add a bus route to start tracking."
        />
        <Card>
          <p className="text-sm text-slate-text">
            Transport route data will appear here after it is created in the
            backend.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Operations · Transport"
        title="Live Fleet Tracking"
        description="Real-time GPS, driver contacts and on-board CCTV of the Bhopal fleet."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Bus}
          label="Active Buses"
          value={`${stats.active} / ${routes.length}`}
          accent="success"
        />
        <StatCard
          icon={Users}
          label="Students Onboard"
          value={String(stats.onboard)}
          accent="amber"
        />
        <StatCard
          icon={Navigation}
          label="On-Time Routes"
          value={String(stats.onTime)}
          accent="info"
        />
        <StatCard
          icon={MapPin}
          label="Delayed Routes"
          value={String(stats.delayed)}
          accent="alert"
        />
      </div>

      {/* ===== Full page-ish map + sidebar ===== */}
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Map */}
        <Card className="lg:col-span-2" bodyClassName="p-0">
          <FleetMap
            routes={routes}
            positions={positions}
            selected={selected}
            onSelect={setSelected}
          />
        </Card>

        {/* Sidebar details */}
        <div className="space-y-4">
          {/* Selected bus head */}
          <Card title={`${activeBus.id} · Live`} bodyClassName="p-4">
            <div className="flex items-center justify-between mb-3">
              <Pill tone={statusTone(activeBus.status)}>
                {activeBus.status}
              </Pill>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-success">
                  <span className="rec-dot" /> LIVE
                </span>
                <button
                  onClick={() => openEdit(activeBus)}
                  className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                  title="Edit bus"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            <p className="text-[13px] font-semibold text-ink leading-snug">
              {activeBus.route}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <Metric
                label="Occupancy"
                value={`${activeBus.occupied}/${activeBus.capacity}`}
                icon={Users}
              />
              <Metric label="ETA" value={activeBus.eta} icon={Navigation} />
              <Metric
                label="Speed"
                value={`${speedOf(activeBus)} km/h`}
                icon={Gauge}
              />
            </div>

            <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11.5px] text-slate-text/70 flex items-center gap-2">
              <MapPin size={13} className="text-slate-text/40 shrink-0" />
              <span className="font-mono">
                {positions[activeBus.id]
                  ? positions[activeBus.id].lat.toFixed(5)
                  : activeBus.lat}
                ,
                {positions[activeBus.id]
                  ? positions[activeBus.id].lng.toFixed(5)
                  : activeBus.lng}
              </span>
            </div>
          </Card>

          {/* Contacts */}
          <Card title="Contacts" bodyClassName="p-4 space-y-3">
            <ContactRow
              icon={User}
              label="Driver"
              name={activeBus.driver}
              phone={activeBus.driverPhone}
              highlighted
            />
            <ContactRow
              icon={User}
              label="Conductor"
              name={activeBus.conductor}
              phone={activeBus.conductorPhone}
            />
            <ContactRow
              icon={Headset}
              label="Transport Desk"
              name={transportDesk.name}
              phone={transportDesk.phone}
            />
          </Card>

          {/* CCTV */}
          <Card
            title="On-Board CCTV"
            action={
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
                <Video size={13} /> {activeBus.cctvCount} cams
              </span>
            }
            bodyClassName="p-4"
          >
            <CctvGrid
              bus={activeBus}
              onOpen={(b, i) => {
                setCctvBus(b);
                setCctvCam(i);
              }}
            />
          </Card>
        </div>
      </div>

      {/* ===== All routes table ===== */}
      <Card
        title="All Routes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search route, driver..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[130px]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Status" : s}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Bus size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No buses found</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try changing filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Bus ID</th>
                  <th className="px-5 py-2.5 font-semibold">Route</th>
                  <th className="px-5 py-2.5 font-semibold">Driver</th>
                  <th className="px-5 py-2.5 font-semibold">Contact</th>
                  <th className="px-5 py-2.5 font-semibold">Occupancy</th>
                  <th className="px-5 py-2.5 font-semibold">Speed</th>
                  <th className="px-5 py-2.5 font-semibold">ETA</th>
                  <th className="px-5 py-2.5 font-semibold">CCTV</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelected(b)}
                    className="border-b border-black/[0.04] hover:bg-paper/60 cursor-pointer"
                  >
                    <td className="px-5 py-3 font-semibold text-ink">{b.id}</td>
                    <td className="px-5 py-3 text-slate-text">{b.route}</td>
                    <td className="px-5 py-3 text-slate-text">{b.driver}</td>
                    <td className="px-5 py-3">
                      <a
                        href={`tel:${b.driverPhone.replace(/\s/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-success text-[12px] font-semibold hover:underline"
                        title={`Call ${b.driver}`}
                      >
                        <Phone size={13} /> Call
                      </a>
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {b.occupied}/{b.capacity}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {speedOf(b)} km/h
                    </td>
                    <td className="px-5 py-3 text-slate-text">{b.eta}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCctvBus(b);
                          setCctvCam(0);
                        }}
                        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-info hover:underline"
                      >
                        <Camera size={13} /> {b.cctvCount} cams
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== EDIT BUS MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  Edit {form.id}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Update route, occupancy and status details.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Route
                </label>
                <Input
                  placeholder="e.g. Arera Colony — MP Nagar — School"
                  value={form.route}
                  onChange={(e) => updateForm("route", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Driver
                  </label>
                  <Input
                    value={form.driver}
                    onChange={(e) => updateForm("driver", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Conductor
                  </label>
                  <Input
                    value={form.conductor}
                    onChange={(e) => updateForm("conductor", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Driver Phone
                  </label>
                  <Input
                    value={form.driverPhone}
                    onChange={(e) => updateForm("driverPhone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Conductor Phone
                  </label>
                  <Input
                    value={form.conductorPhone}
                    onChange={(e) =>
                      updateForm("conductorPhone", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Occupied
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.occupied}
                    onChange={(e) =>
                      updateForm("occupied", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Capacity
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.capacity}
                    onChange={(e) =>
                      updateForm("capacity", Number(e.target.value))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    ETAL
                  </label>
                  <Input
                    value={form.eta}
                    onChange={(e) => updateForm("eta", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    <option value="On Route">On Route</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Not Started">Not Started</option>
                    <option value="Arrived">Arrived</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Last Stop
                </label>
                <Input
                  value={form.lastStop}
                  onChange={(e) => updateForm("lastStop", e.target.value)}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="amber" onClick={handleSave}>
                <Save size={15} /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CCTV LIVE VIEW MODAL ===== */}
      {cctvBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/85 backdrop-blur-sm"
            onClick={() => setCctvBus(null)}
          />
          <div className="relative bg-ink-dark rounded-2xl w-full max-w-3xl overflow-hidden border border-white/10">
            {/* header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-alert/15 text-alert flex items-center justify-center">
                  <Video size={18} />
                </div>
                <div>
                  <p className="font-display font-semibold text-white text-[15px]">
                    {cctvBus.id} · CAM {String(cctvCam + 1).padStart(2, "0")} —{" "}
                    {CAMERA_POSITIONS[cctvCam % CAMERA_POSITIONS.length].label}
                  </p>
                  <p className="text-[11.5px] text-white/50">{cctvBus.route}</p>
                </div>
              </div>
              <button
                onClick={() => setCctvBus(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70"
              >
                <X size={20} />
              </button>
            </div>

            {/* feed */}
            <LiveFeed bus={cctvBus} cam={cctvCam} />

            {/* camera switcher */}
            <div className="px-4 py-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              {Array.from({ length: cctvBus.cctvCount || 4 })
                .slice(0, 6)
                .map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCctvCam(i)}
                    className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors ${
                      cctvCam === i
                        ? "bg-amber text-ink"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    CAM {String(i + 1).padStart(2, "0")} ·{" "}
                    {CAMERA_POSITIONS[i % CAMERA_POSITIONS.length].label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Live feed (simulated) ---------------------------------------------------
function LiveFeed({ bus, cam }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pos = CAMERA_POSITIONS[cam % CAMERA_POSITIONS.length];

  return (
    <div className="relative aspect-video w-full bg-ink overflow-hidden">
      {/* simulated road scene */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0F172E 0%, #1F2E52 45%, #0F172E 100%)",
        }}
      />
      <div className="absolute left-0 right-0 top-[54%] h-px bg-white/15" />
      <div className="absolute left-0 right-0 top-[72%] h-[2px] bg-white/10" />
      {/* moving vehicle silhouettes */}
      <div className="absolute bottom-0 left-0 right-0 h-[30%]">
        <span className="cctv-car" style={{ animationDelay: "0s" }} />
        <span
          className="cctv-car cctv-car-2"
          style={{ animationDelay: "1.2s" }}
        />
        <span
          className="cctv-car cctv-car-3"
          style={{ animationDelay: "2.4s" }}
        />
      </div>
      {/* overlay grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* static noise */}
      <div className="cctv-noise absolute inset-0 opacity-[0.05]" />

      {/* HUD */}
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="rec-dot" />
        <span className="text-[11px] font-bold text-alert tracking-widest">
          REC
        </span>
        <span className="text-[11px] font-semibold text-white/70 ml-1">
          {bus.id} · {bus.route.split(" — ")[0]} → School
        </span>
      </div>
      <div className="absolute top-3 right-4 text-right">
        <p className="text-[11px] font-semibold text-white/70 font-mono tabular-nums">
          {now.toLocaleDateString("en-IN")}{" "}
          {now.toLocaleTimeString("en-IN", { hour12: false })}
        </p>
      </div>
      <div className="absolute bottom-3 left-4 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-black/40 text-white text-[10px] font-mono font-semibold">
          {bus.id}-CAM{String(cam + 1).padStart(2, "0")}
        </span>
        <span className="px-2 py-0.5 rounded bg-success/80 text-white text-[10px] font-mono font-semibold">
          MPDMR
        </span>
        <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-[10px] font-mono">
          LIVE CCTV
        </span>
      </div>
      <div className="absolute bottom-3 right-4 text-[10px] font-mono text-white/50">
        {bus.lat.toFixed(5)},{bus.lng.toFixed(5)} · {pos.label}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg bg-paper p-2.5">
      <p className="flex items-center gap-1 text-[10.5px] text-slate-text/60 font-medium">
        <Icon size={11} /> {label}
      </p>
      <p className="font-display font-bold text-ink text-[15px] mt-0.5">
        {value}
      </p>
    </div>
  );
}
