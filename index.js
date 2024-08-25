const canvas = document.querySelector("canvas");

if (!navigator.gpu)
  throw new Error("WebGPU not supported on this browser.");
const adapter = await navigator.gpu.requestAdapter();
if (!adapter)
  throw new Error("No appropriate GPUAdapter found.");
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({device: device, format: canvasFormat,});

const vertices = new Float32Array([
  -1.0, -1.0,
  1.0, -1.0,
  1.0,  1.0,
  -1.0, -1.0,
  1.0,  1.0,
  -1.0,  1.0,
]);

const vertexBuffer = device.createBuffer({
  label: "vertices",
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);

const vertexBufferLayout = {
  arrayStride: 8,
  attributes: [{
    format: "float32x2",
    offset: 0,
    shaderLocation: 0,
  }],
};

const circlePosition = new Float32Array([0.0, 0.0]);
const circlePositionBuffer = device.createBuffer({
  label: "Circle Position",
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(circlePositionBuffer, 0, circlePosition);

const circleColorTop = new Float32Array([0.902, 0.825, 0.051, 1.0]);
const circleColorTopBuffer = device.createBuffer({
  label: "Circle Color Top",
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(circleColorTopBuffer, 0, circleColorTop);

const circleColorBottom = new Float32Array([1.0, 0.0, 1.0, 1.0]);
const circleColorBottomBuffer = device.createBuffer({
  label: "Circle Color Bottom",
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(circleColorBottomBuffer, 0, circleColorBottom);

const backgroundTopColor = new Float32Array([0.451, 0.345, 1, 0.839]);
const backgroundTopColorBuffer = device.createBuffer({
  label: "Background Top Color",
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(backgroundTopColorBuffer, 0, backgroundTopColor);

const backgroundBottomColor = new Float32Array([0.0, 0.0, 0.4, 1.0]);
const backgroundBottomColorBuffer = device.createBuffer({
  label: "Background Bottom Color",
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(backgroundBottomColorBuffer, 0, backgroundBottomColor);

const bindGroupLayout = device.createBindGroupLayout({
  label: "Bind Group Layout",
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.FRAGMENT,
    buffer: {type: "uniform"}
    }, {
    binding: 1,
    visibility: GPUShaderStage.FRAGMENT,
    buffer: {type: "uniform"}
    }, {
    binding: 2,
    visibility: GPUShaderStage.FRAGMENT,
    buffer: {type: "uniform"}
    }, {
    binding: 3,
    visibility: GPUShaderStage.FRAGMENT,
    buffer: {type: "uniform"}
    }, {
    binding: 4,
    visibility: GPUShaderStage.FRAGMENT,
    buffer: {type: "uniform"}
    },
  ]
});

const bindGroup =
  device.createBindGroup({
    label: "renderer bind group",
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: circlePositionBuffer}
    }, {
      binding: 1,
      resource: { buffer: circleColorTopBuffer }
    }, {
      binding: 2,
      resource: { buffer: circleColorBottomBuffer}
    }, {
      binding: 3,
      resource: { buffer: backgroundTopColorBuffer}
    }, {
      binding: 4,
      resource: { buffer: backgroundBottomColorBuffer}
    }
    ],
  })

const shaderModule = device.createShaderModule({
  label: "shader",
  code: `
    struct VertexInput {
      @location(0) pos: vec2<f32>,
    };

    struct VertexOutput {
      @builtin(position) pos: vec4<f32>,
      @location(0) posXY: vec2<f32>,
    };

    @group(0) @binding(0) var<uniform> circlePos: vec2<f32>;
    @group(0) @binding(1) var<uniform> circleColorTop: vec4<f32>;
    @group(0) @binding(2) var<uniform> circleColorBottom: vec4<f32>;
    @group(0) @binding(3) var<uniform> backgroundTopColor: vec4<f32>;
    @group(0) @binding(4) var<uniform> backgroundBottomColor: vec4<f32>;


    fn sdfCircle(p: vec2<f32>, r: f32) -> f32 {
      return length(p) - r;
    }

    fn sdfRectangle(p: vec2<f32>, b: vec2<f32>) -> f32 {
      var d = abs(p)-b;
      return length(max(d, vec2<f32>(0.0))) + min(max(d.x,d.y),0.0);
    }

    fn opSub(d1: f32, d2: f32) -> f32 {
      return max(-d1, d2);
    }

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
      var output: VertexOutput;
      output.pos = vec4<f32>(input.pos, 0, 1);
      output.posXY = input.pos;
      return output;
    }

    @fragment
    fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
      var circle = sdfCircle(input.posXY - circlePos, 0.8);
      let tBackground = (input.posXY.y + 1.0) / 2.0;
      let backgroundColor = mix(backgroundBottomColor, backgroundTopColor, tBackground);
      let rect1 = sdfRectangle(input.posXY - vec2<f32>(0.0, -0.61), vec2<f32>(2.0, 0.070));
      let rect2 = sdfRectangle(input.posXY - vec2<f32>(0.0, -0.368), vec2<f32>(2.0, 0.058));
      let rect3 = sdfRectangle(input.posXY - vec2<f32>(0.0, -0.16), vec2<f32>(2.0, 0.038));
      let rect4 = sdfRectangle(input.posXY - vec2<f32>(0.0, 0.0), vec2<f32>(2.0, 0.025));
      let rect5 = sdfRectangle(input.posXY - vec2<f32>(0.0, 0.12), vec2<f32>(2.0, 0.013));

      circle = opSub(rect1, circle);
      circle = opSub(rect2, circle);
      circle = opSub(rect3, circle);
      circle = opSub(rect4, circle);
      circle = opSub(rect5, circle);

      if (circle < 0.0) {
        let t = (input.posXY.y + 0.8) / 1.6;
        return mix(circleColorBottom, circleColorTop, t);
      } else {
        return backgroundColor;
      }
    }
  `
});

const pipelineLayout = device.createPipelineLayout({
  label: "pipeline Layout",
  bindGroupLayouts: [bindGroupLayout],
});

 const pipeline = device.createRenderPipeline({
  label: "pipeline",
  layout: pipelineLayout,
  vertex: {
    module: shaderModule,
    entryPoint: "vertexMain",
    buffers: [vertexBufferLayout]
  },
  fragment: {
    module: shaderModule,
    entryPoint: "fragmentMain",
    targets: [{
      format: canvasFormat
    }]
  }
});

function render()
{
  const encoder = device.createCommandEncoder();

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
      storeOp: "store",
    }]
  });

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setBindGroup(0, bindGroup);
  pass.draw(vertices.length / 2);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

render();
