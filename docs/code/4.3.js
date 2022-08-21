/*
  缺陷：副作用函数与被操作的目标字段没有建立明确的联系
  例如：
    当读取属性时，无论读取的是哪个属性，都会把副作用函数收集到桶里。
    当设置属性时，无论设置的是哪个属性，也都会把桶里的副作用函数取出并执行。
*/
(function () {
  // 存储副作用函数的桶
  const bucket = new Set();

  // 原始数据
  const data = { text: "hello4.3" };
  // 对原始数据的代理
  const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
      // 将副作用函数添加effect添加到存储副作用函数的桶中
      if (activeEffect) {
        bucket.add(activeEffect);
      }
      // 返回属性值
      return target[key];
    },
    // 拦截写入操作
    set(target, key, value) {
      // 设置属性值
      target[key] = value;
      // 把副作用函数从桶里取出并执行
      bucket.forEach(fn => fn());
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

  setTimeout(() => {
    obj.text = "world4.3";
  }, 1000);

  // 缺陷：非目标字段也会触发副作用函数
  // 示例：
  // setTimeout(() => {
  //   obj.noExist = "hello vue3 4.3";
  // }, 2000);
})();
