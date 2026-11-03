// ---- tuning constants -------------------------------------------------
var SEG_LEN = 200;          // world units per road segment
var RUMBLE = 3;             // segments per colour band
var ROAD_W = 2000;          // half-width of road in world units
var LANES = 3;
var DRAW_DIST = 200;        // segments drawn ahead
var CAM_H = 900;            // camera height
var CAM_DEPTH = 0.84;       // 1/tan(fov/2) ~ 65 deg
var PLAYER_Z = 900;         // player car sits this far in front of the camera
var FOG_DENSITY = 4.6;      // higher = shorter visibility
var MAX_SPEED = SEG_LEN * 50;         // flat-out lap ~22s, race lap ~30s
var LAP_TARGET = 29.5;                // reference lap for AI + ghost pacing
var ACCEL = MAX_SPEED / 4.2;          // 0..top in ~4.2s
var BRAKING = -MAX_SPEED / 1.35;
var DECEL = -MAX_SPEED / 6.0;         // lift off
var OFF_ROAD_DECEL = -MAX_SPEED / 1.1;
var OFF_ROAD_LIMIT = MAX_SPEED * 0.34;
var CENTRIFUGAL = 0.34;
var CORNER_GRIP = 0.028;    // corner speed model: f = 1 / (1 + k * c^2)
var CORNER_MIN = 0.52;      // never slower than 52% of top speed
var STEER_RATE = 2.05;      // full lock steering speed at top speed
var CAR_HW = 0.30;          // half width, road units (1.0 = road edge)
var HIT_SPEED_RETAIN = 0.55;
var TOP_GEAR_KMH = 312;

// race rules
var QUALI_TIME = 75;        // seconds of qualifying
var RACE_LAPS = 5;
var GRID_ROWS = 3;          // 2 cars per row, 6 opponents

// rendering
var RENDER_W = 340;         // internal low-res width (portrait/landscape split later)
