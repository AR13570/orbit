import { useId, type CSSProperties } from "react";

const journey =
  "M24 184 C70 181 70 69 135 53 C205 34 183 163 251 153 C282 148 280 113 288 93";
const outerOrbit =
  "M259 81 C276 117 229 161 171 174 C109 189 57 170 61 132 C65 96 115 57 173 47 C220 38 249 53 259 81Z";
const innerOrbit =
  "M194 48 C232 62 236 120 207 158 C179 196 133 182 117 149 C100 113 113 65 146 49 C163 41 180 42 194 48Z";

function travel(
  path: string,
  duration: string,
  delay = "0s",
  rotate = "0deg",
): CSSProperties {
  return {
    offsetPath: `path("${path}")`,
    offsetRotate: rotate,
    offsetAnchor: "0px 0px",
    animation: `home-travel ${duration} linear ${delay} infinite`,
  };
}

function MovingPlanet({
  path,
  color,
  radius,
  duration,
  motion,
  start,
  delay = "0s",
}: {
  path: string;
  color: string;
  radius: number;
  duration: string;
  motion: boolean;
  start: [number, number];
  delay?: string;
}) {
  return (
    <circle
      className="home-moving-planet"
      r={radius}
      fill={color}
      cx={motion ? 0 : start[0]}
      cy={motion ? 0 : start[1]}
      style={motion ? travel(path, duration, delay) : undefined}
    />
  );
}

export default function ModePreview({
  mode,
  motion,
}: {
  mode: "odessey" | "gravity";
  motion: boolean;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={`home-preview home-preview-${mode}`}
      viewBox="0 20 320 180"
      aria-hidden="true"
      data-motion={motion ? "playing" : "still"}
    >
      <defs>
        <pattern
          id={`${id}-dots`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="4" cy="4" r="0.8" fill="#527c9a" opacity=".28" />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset=".3" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-field`}>
          <ellipse
            cx="160"
            cy="111"
            rx="145"
            ry="102"
            fill={`url(#${id}-fade)`}
          />
        </mask>
      </defs>
      <rect
        width="320"
        height="220"
        fill={`url(#${id}-dots)`}
        mask={`url(#${id}-field)`}
      />
      {mode === "odessey" ? (
        <>
          <circle
            cx="131"
            cy="112"
            r="55"
            fill="none"
            stroke="#245f78"
            opacity=".09"
          />
          <circle
            cx="131"
            cy="112"
            r="44"
            fill="none"
            stroke="#245f78"
            opacity=".14"
          />
          <circle cx="131" cy="112" r="33" fill="#245f78" />
          <path
            d="m124 109 5 3-5 3m14-6-5 3 5 3"
            fill="none"
            stroke="#dce9ed"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="231" cy="63" r="16" fill="#b64d32" />
          <circle
            cx="231"
            cy="63"
            r="26"
            fill="none"
            stroke="#b64d32"
            opacity=".12"
          />
          <path
            d={journey}
            fill="none"
            stroke="#527c9a"
            strokeWidth="1.5"
            strokeDasharray="1 6"
            strokeLinecap="round"
            opacity=".55"
          />
          <circle
            cx="288"
            cy="93"
            r="13"
            fill="none"
            stroke="#168dff"
            strokeWidth="1.2"
          />
          <path
            d="M286 99V87l7 3-7 3"
            fill="none"
            stroke="#168dff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <g
            className="home-moving-ship"
            transform={motion ? undefined : "translate(64 156) rotate(-60)"}
            style={motion ? travel(journey, "6.8s", "0s", "auto") : undefined}
          >
            <path d="M-6-4 9 0-6 4-2 0Z" fill="#8a0f4b" />
          </g>
        </>
      ) : (
        <>
          <circle
            cx="164"
            cy="113"
            r="66"
            fill="none"
            stroke="#245f78"
            opacity=".08"
          />
          <circle
            cx="164"
            cy="113"
            r="49"
            fill="none"
            stroke="#245f78"
            opacity=".12"
          />
          <path
            d={outerOrbit}
            fill="none"
            stroke="#007c9e"
            strokeWidth="1.25"
            opacity=".55"
          />
          <path
            d={innerOrbit}
            fill="none"
            stroke="#cf315c"
            strokeWidth="1.25"
            opacity=".45"
          />
          <circle cx="164" cy="113" r="32" fill="#245f78" />
          <path
            d="m157 110 5 3-5 3m14-6-5 3 5 3"
            fill="none"
            stroke="#dce9ed"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <MovingPlanet
            path={outerOrbit}
            color="#007c9e"
            radius={7}
            duration="10s"
            motion={motion}
            start={[242, 132]}
          />
          <MovingPlanet
            path={innerOrbit}
            color="#cf315c"
            radius={8.5}
            duration="8s"
            motion={motion}
            start={[129, 169]}
            delay="-3s"
          />
          <MovingPlanet
            path={outerOrbit}
            color="#a66b00"
            radius={4.5}
            duration="10s"
            motion={motion}
            start={[74, 107]}
            delay="-5s"
          />
        </>
      )}
    </svg>
  );
}
