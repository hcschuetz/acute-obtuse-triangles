import { useEffect, useRef, useState } from 'preact/hooks'
import type { TargetedEvent } from 'preact/compat';

import './app.css';


const n = 1e5;
const size = 600;
const dotSize = 1;
const padding = 10;
const colors: Record<AngleName, string> = {
  𝛼: "#f00",
  𝛽: "#0f0",
  𝛾: "#00f",
  none: "#000",
};


type Point = [number, number];
type Triangle = [Point, Point, Point];

const angleNames = ["𝛼", "𝛽", "𝛾", "none"] as const;
type AngleName = (typeof angleNames)[number];

const TAU = 2 * Math.PI;

function distSq([x0, y0]: Point, [x1, y1]: Point): number {
  const dx = x1 - x0, dy = y1 - y0;
  return dx*dx + dy*dy;
}

const r3 = Math.sqrt(3);
const r3half = Math.sqrt(3) / 2;

const randomTriangle = () =>
  Array.from({length: 3}, () => {
    const theta = TAU * Math.random();
    const r =
      // 1; // vertices uniformly distributed on unit circle
      Math.sqrt(-2 * Math.log(Math.random())); // normally distributed vertices
    return [r * Math.cos(theta), r * Math.sin(theta)];
  }) as Triangle;

function getTriangleData([A, B, C]: Triangle): {xy: Point, obtuse: AngleName} | null {
  const aSq = distSq(B, C);
  const bSq = distSq(A, C);
  const cSq = distSq(A, B);;

  const sqSum = aSq + bSq + cSq;
  if (!sqSum) return null;
  const scale = 1 / sqSum;

  return {
    xy: [
      scale * (aSq - (bSq + cSq) * .5    ),
      scale * (      (bSq - cSq) * r3half),
    ],
    obtuse:
      aSq > bSq + cSq ? "𝛼" :
      bSq > aSq + cSq ? "𝛽" :
      cSq > aSq + bSq ? "𝛾" :
      "none",
  };
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] =
    useState<Record<AngleName, number>>({none: 0, 𝛼: 0, 𝛽: 0, 𝛾: 0});

  const [mouseTriangle, setMouseTriangle] = useState<[Point, Point, Point]>();
  const [angles, setAngles] = useState<[number, number, number]>();
  const [debugText, setDebugText] = useState("");
  function handleMouse(event: TargetedEvent<Element, MouseEvent>) {
    // TODO decompose this into several functions

    const debugData: Array<string | number> = [];
    function debug(...args: Array<string | number>) {
      // debugData.push(...args);
    }
    debug("Debug Output:");
    try {
      setMouseTriangle(undefined);
      setAngles(undefined);

      // convert browser coordinates to our logical coordinates
      const {left, top} = event.currentTarget.getBoundingClientRect();
      const {clientX, clientY} = event;
      const x = ((clientX - left - padding - dotSize/2) / size - .5);
      const y = ((clientY - top  - padding - dotSize/2) / size - .5);
      debug("\nxy:", x, y);

      // In getTriangleData() we map the squared side lengths of the triangle
      // to xy coordinates in the dots canvas:
      //   aa - .5   bb - .5   cc = x
      //        r3/2 bb - r3/2 cc = y
      // Furthermore the squared side lengths are normalized:
      //   aa +      bb +      cc = 1
      // We can resolve for aa, bb, and cc:
      const p = (1 - x)/3, q = y/r3;
      const aa = p + x;
      const bb = p + q;
      const cc = p - q;
      debug("\nside-length squares:", aa+bb+cc, aa, bb, cc)
      if (aa < 0 || bb < 0 || cc < 0) {
        debug("\nnegative side-length square");
        return; 
      }

      // TODO Get rid of some/all of the trig functions below?

      // Get the three angles by inverting the law of cosines:
      const cos𝛼 = (.5 - aa)/Math.sqrt(bb*cc);
      const cos𝛽 = (.5 - bb)/Math.sqrt(aa*cc);
      const cos𝛾 = (.5 - cc)/Math.sqrt(aa*bb);
      debug("\ncosines:", cos𝛼, cos𝛽, cos𝛾);
      if (Math.abs(cos𝛼) > 1 || Math.abs(cos𝛽) > 1 || Math.abs(cos𝛾) > 1) {
        debug("\ncosine out of range");
        return;
      }
      const 𝛼 = Math.acos(cos𝛼);
      const 𝛽 = Math.acos(cos𝛽);
      const 𝛾 = Math.acos(cos𝛾);
      debug("\nangles:", 𝛼+𝛽+𝛾, 𝛼, 𝛽, 𝛾);
      setAngles([𝛼, 𝛽, 𝛾]);

      // Place the triangle vertices on the unit circle with double angles 2*𝛼,
      // 2*𝛽, 2*𝛾 between them.
      // This ensures that the angles at the vertices are 𝛼, 𝛽, 𝛾 according to
      // the inscribed-angle theorem.
      // The relatively complicated formulas for the "position angles"
      // angleA, angleB, and angleC ensure some symmetry in the attitude
      // assignment.
      const angleA = (       2*(𝛽 - 𝛾))/3, A: Point = [Math.cos(angleA), Math.sin(angleA)];
      const angleB = ( TAU + 2*(𝛾 - 𝛼))/3, B: Point = [Math.cos(angleB), Math.sin(angleB)];
      const angleC = (-TAU + 2*(𝛼 - 𝛽))/3, C: Point = [Math.cos(angleC), Math.sin(angleC)];
      const triangle: Triangle = [A, B, C];

      // Scale the triangle so that the squared side lengths sum up to 1:
      const scale = 1/Math.sqrt(distSq(B, C) + distSq(A, C) + distSq(A, B));
      debug("\nscale:", scale);
      triangle.forEach(point => [0,1].forEach(i => point[i] *= scale));

      // Move the triangle so that its centroid is at the canvas center.
      const xCenter = (A[0] + B[0] + C[0]) / 3;
      const yCenter = (A[1] + B[1] + C[1]) / 3;
      triangle.forEach(point => {point[0] -= xCenter; point[1] -= yCenter});
      debug("\ncoords:", ...triangle.flat(1));
      debug("\nside-length squares:", distSq(B, C), distSq(A, C), distSq(A, B));

      // This finally is the triangle to draw:
      setMouseTriangle(triangle);
    } finally {
      setDebugText(debugData.map(x =>
        typeof x === "number" ? x.toFixed(3) : x).join(" ")
      );

      // I hoped that the following calls improve the behavior on touch screens,
      // but they don't help.  (And for now I am too lazy to figure out another
      // solution.)
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  const mousePosToTriangle = {
    onMouseMove: handleMouse,
    onMouseEnter: handleMouse,
    onMouseLeave: () => {
      setMouseTriangle(undefined);
      setAngles(undefined);
    },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size + dotSize, size + dotSize);

    const counts = {none: 0, 𝛼: 0, 𝛽: 0, 𝛾: 0};
    for (let i = 0; i < n; i++) {
      const triangleData = getTriangleData(randomTriangle());
      if (!triangleData) continue;
      const {xy: [x, y], obtuse} = triangleData;
      counts[obtuse]++;
      ctx.fillStyle = colors[obtuse];
      ctx.fillRect(size * (x + .5), size * (y + .5), dotSize, dotSize);
    }
    setStats(counts);
  }, [canvasRef.current]); 

  return (
    <>
      <div style={{maxWidth: "600px", margin: "0 auto"}}>
        <h1>Acute and Obtuse Triangles</h1>
        <p>
          Inspired by {}
          <a href="https://eigenpod.de/eig051-dreiecke-unterm-kopfkissen/"
            target="_blank" rel="noopener noreferrer"
          >Eigenraum episode 51</a>
        </p>
        <p>
          The first image contains points representing {n} random triangles.
          We do not care about position, orientation or absolute side lengths
          but only about length ratios or, equivalently, about the angles.
          In other words, we care about classes of similar triangles.
          Such a class can be described by 2 numeric parameters
          and can thus be represented as a point in 2D space.
          (For details of the random distribution
          and of the mapping between triangles and 2D points
          have a look at
          {} <a href="https://github.com/hcschuetz/acute-obtuse-triangles"
            target="_blank" rel="noopener noreferrer"
            >the code</a> {}
          or at the Eigenraum episode and its referenced literature.)
        </p>
        <p>
          Black points represent acute triangles.
          The other points represent obtuse triangles
          with the colors indicating which of the three angles is the obtuse one.
        </p>
        <p>
          Move your mouse pointer into the circle.
          Then an example triangle corresponding to your mouse position
          will be drawn in the second image.
        </p>
      </div>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "1em",
      }}>
        <div style={{display: "inline-block", width: size + dotSize + 2*padding}}>
          <canvas ref={canvasRef}
            width={size + dotSize} height={size + dotSize}
            style={{background: "#eee", padding}}
            {...mousePosToTriangle}
          ></canvas>
          <div>
            {angleNames.map(obtuse => (
              <span style={{color: colors[obtuse]}}>
                {obtuse} obtuse:&nbsp;
                <output>{(stats[obtuse] / n * 100).toFixed(1)}%</output>; {}
              </span>
            ))}
          </div>
        </div>
        <div style={{display: "inline-block", width: size + dotSize + 2*padding}}>
          <svg width={size + dotSize} height={size + dotSize}
            viewBox="-.5 -.5 1 1"
            style={{background: "#eee", padding}}
          >
            {mouseTriangle && <>
              <polygon
                points={mouseTriangle.flat().join(" ")}
                stroke-width={.005} stroke="#000"
                fill="none"
              />
              {mouseTriangle.map(([x,y], i) => (
                <circle cx={x} cy={y} r={.01} fill={colors[angleNames[i]]}/>
              ))}
            </>}
          </svg>
          <div>{
            angles?.map((a, i) => {
              const name = angleNames[i]
              return (<>
                {i > 0 && " "}
                <span style={{color: colors[name]}}>
                  {name} = {(a * (360/TAU)).toFixed(2)}°;
                </span>
              </>)
            })}
            {/* zero width space ensuring text height even without angles: */}
            &#x200b;
          </div>
        </div>
      </div>
      <pre>{debugText}</pre>
      <div style={{maxWidth: "600px", margin: "0 auto"}}>
        <h1>Isogonic Lines</h1>
        <p>
          In the first image all the triangles
          where a particular vertex has a right angle
          are mapped to points on a straight line,
          namely the border between the black central triangle and
          the segment with the vertex color.
          So I was curious along which lines you find the points for triangles
          with a particular vertex having some other fixed angle.
          For these lines I borrow the term "isogonic" from geology.
        </p>
        <p>
          The following image contains the isogonic lines
          for the three vertices and the angles
          15°, 30°, 45°, 60°, 75°, 90°, 105°, 120°, 135°, 150°, 165°.
          (The outermost black circle contains the points for degenerate
          triangles with at least one 0° angle.)
        </p>
        <p>
          Again you can move your mouse pointer into the image
          to see an example triangle.
        </p>
        <div style={{display: "inline-block", width: size + dotSize + 2*padding}}>
          <svg width={size + dotSize} height={size + dotSize}
            style={{background: "#eee", padding}}
            {...mousePosToTriangle}
          >
            <g transform={`
              translate(${dotSize/2}, ${dotSize/2})
              scale(${(size)})
              translate(.5, .5)
            `}>
              <g stroke="#00f">
                <g id="isogons" stroke-width={.003} fill="none">
                  {(() => {
                    const A: Point = [1, 0];
                    return Array.from({length: 13}, (_, i) => {
                      const 𝛾2 = TAU/12 * i;
                      const rest = TAU - 𝛾2;
                      const B: Point = [Math.cos(𝛾2), Math.sin(𝛾2)];
                      return (
                        <polyline points={
                          Array.from({length: 121}, (_, j) => {
                            const 𝛽2 = -rest/120 * j;
                            const C: Point = [Math.cos(𝛽2), Math.sin(𝛽2)];
                            return getTriangleData([A, B, C])?.xy ?? [];
                          }).flat().join(" ")
                        }/>
                      )
                    })
                  })()}
                </g>
              </g>
              <g stroke="#f00" transform="rotate(+120)"><use href="#isogons"/></g>
              <g stroke="#0f0" transform="rotate(-120)"><use href="#isogons"/></g>
              <circle r={.5} stroke-width={.003} stroke="#000" fill="none"/>
            </g>
          </svg>
        </div>
      </div>
    </>
  )
}
