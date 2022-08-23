// 实际上，watch的实现本质上就是利用了effect以及option.scheduler选项
function watch(source, cb, options) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  // 定义旧值与新值
  let oldValue, newValue;

  // 存储用户注册的过期回调
  let cleanup;
  // 定义onInvalidate函数
  function onInvalidate(fn) {
    cleanup = fn;
  }

  const job = () => {
    // 在scheduler中重新执行副作用函数，得到的是新值
    newValue = effectFn();
    // 在调用回调函数cb之前，前调用过期回调
    cleanup && cleanup();
    // 将旧值和新值作为回调函数的参数，onInvalidate作为第三个参数方便用户使用
    cb(newValue, oldValue, onInvalidate);
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue;
  };

  // 使用 effect 注册副作用函数时，开启lazy选项，并把返回值存储到 effectFn 中以便后续手动调用
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: () => {
      // 在调度函数中判断flush是否为'post'，如果是，将其放到微任务队列中执行
      if (options.flush === "post") {
        const p = Promise.resolve();
        p.then(job);
      } else {
        job();
      }
    }
  });

  if (options.immediate) {
    job();
  } else {
    // 手动调用副作用函数，拿到的就是旧值
    oldValue = effectFn();
  }
}
// 封装的通用读取函数
function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，获知已经被读取过了，那么什么都不做
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value);
  // 暂时不考虑数组等其他结构
  // 假设 value 就是一个对象，使用for...in读取对象的每一个值，并递归地调用traverse进行处理
  for (const k in value) {
    traverse(value[k], seen);
  }

  return value;
}
