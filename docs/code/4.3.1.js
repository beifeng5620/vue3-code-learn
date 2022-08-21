(function () {
  // 存储副作用函数的桶
  const bucket = new WeakMap();

  // 原始数据
  const data = { text: "hello4.3.1" };
  // 对原始数据的代理
  const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
      // 没有activeEffect时，直接return
      if (!activeEffect) {
        return target[key];
      }

      // 根据target从桶中取出对象的副作用函数集,它是个map类型，对象名 <=> 副作用函数集，如果没有，则创建一个
      let depsMap = bucket.get(target);
      if (!depsMap) {
        depsMap = new Map();
        bucket.set(target, depsMap);
      }

      // 再从depsMap中取出字段对应的副作用函数集
      let deps = depsMap.get(key);
      if (!deps) {
        deps = new Set();
        depsMap.set(key, deps);
      }
      // 最后将当前激活的副作用函数添加到字段的副作用函数集中
      deps.add(activeEffect);

      // 返回属性值
      return target[key];
    },
    // 拦截写入操作
    set(target, key, value) {
      // 设置属性值
      target[key] = value;

      // 从桶中取出对象的副作用函数集
      const depsMap = bucket.get(target);
      if (!depsMap) {
        return true;
      }

      // 从depsMap中取出字段对应的副作用函数集
      const deps = depsMap.get(key);
      if (!deps) {
        return true;
      }
      // 执行副作用函数集中的函数
      deps.forEach(effect => effect());

      // 返回true，表示写入成功
      return true;
    }
  });

  // 用一个全局变量指向当前正在执行的副作用函数
  let activeEffect = null;
  function effect(fn) {
    // 当调用effect时，将当前正在执行的副作用函数设置为fn
    activeEffect = fn;
    fn();
  }

  effect(() => {
    console.log("effect: ", obj.text);
  });

  // setTimeout(() => {
  //   obj.text = "world4.3.1";
  // }, 1000);

  // 4.3缺陷：非目标字段也会触发副作用函数
  // 示例：
  // setTimeout(() => {
  //   obj.noExist = "hello vue3 4.3";
  // }, 2000);
})();
