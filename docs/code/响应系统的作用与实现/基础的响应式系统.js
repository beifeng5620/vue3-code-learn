const data = {
  a: 1,
  b: 2
};

let activeEffect;
const effectStack = [];

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn);

    activeEffect = effectFn;
    effectStack.push(effectFn);

    fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  effectFn.deps = [];
  effectFn();
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

    return targetObj[key];
  },
  set(targetObj, key, newVal) {
    targetObj[key] = newVal;

    const depsMap = reactiveMap.get(targetObj);

    if (!depsMap) return;

    const effects = depsMap.get(key);

    // effects && effects.forEach(fn => fn())
    // const effectsToRun = new Set(effects);
    const effectsToRun = new Set();
    effects &&
      effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
    effectsToRun.forEach(effectFn => effectFn());
  }
});
