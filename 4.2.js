// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { text: "hello" };
// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数添加effect添加到存储副作用函数的桶中
    bucket.add(effect);
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

function effect() {
  console.log("effect: ", obj.text);
}

effect();
setTimeout(() => {
  obj.text = "world";
}, 1000);
