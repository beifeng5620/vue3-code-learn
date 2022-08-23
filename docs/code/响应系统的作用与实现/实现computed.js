const data = {
  a: 1,
  b: 2
};

let activeEffect;
const effectStack = [];

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);

    activeEffect = effectFn;
    effectStack.push(effectFn);

    const res = fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];

    return res;
  };
  effectFn.deps = [];
  effectFn.options = options;

  if (!options.lazy) {
    effectFn();
  }

  return effectFn;
}

function computed(fn) {
  let value;
  let dirty = true;
  const effectFn = effect(fn, {
    lazy: true,
    scheduler(fn) {
      if (!dirty) {
        dirty = true;
        trigger(obj, "value");
      }
    }
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      console.log(obj);
      return value;
    }
  };

  return obj;
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

const reactiveMap = new WeakMap();

const obj = new Proxy(data, {
  get(targetObj, key) {
    track(targetObj, key);

    return targetObj[key];
  },
  set(targetObj, key, newVal) {
    targetObj[key] = newVal;

    trigger(targetObj, key);
  }
});

function track(targetObj, key) {
  let depsMap = reactiveMap.get(targetObj);

  if (!depsMap) {
    reactiveMap.set(targetObj, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);

  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  deps.add(activeEffect);

  activeEffect.deps.push(deps);
}

function trigger(targetObj, key) {
  const depsMap = reactiveMap.get(targetObj);

  if (!depsMap) return;

  const effects = depsMap.get(key);

  // const effectsToRun = new Set(effects);
  const effectsToRun = new Set();
  effects &&
    effects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
