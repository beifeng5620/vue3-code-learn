# 响应系统的作用与实现

## 响应式的基本原理
通过proxy拦截变动并触发对应的副作用函数执行。

首先，什么是响应式呢？

响应式就是被观察的数据变化的时候做一系列联动处理。

就像一个社会热点事件，当它有消息更新的时候，各方媒体都会跟进做相关报道。

这里社会热点事件就是被观察的目标。

那在前端框架里，这个被观察的目标是什么呢？

很明显，是状态。

状态一般是多个，会通过对象的方式来组织。所以，我们观察状态对象的每个 key 的变化，联动做一系列处理就可以了。

我们要维护这样的数据结构：

![](/基础的响应式系统/reactive.png)

状态对象的每个 key 都有关联的一系列 effect 副作用函数，也就是变化的时候联动执行的逻辑，通过 Set 来组织。

每个 key 都是这样关联了一系列 effect 函数，那多个 key 就可以放到一个 Map 里维护。

这个 Map 是在对象存在的时候它就存在，对象销毁的时候它也要跟着销毁。（因为对象都没了自然也不需要维护每个 key 关联的 effect 了）

而 WeakMap 正好就有这样的特性，WeakMap 的 key 必须是一个对象，value 可以是任意数据，key 的对象销毁的时候，value 也会销毁。

所以，响应式的 Map 会用 WeakMap 来保存，key 为原对象。

这个数据结构就是响应式的核心数据结构了。

如何自动的依赖收集？

读取状态值的时候，就建立了和该状态的依赖关系，所以很容易想到可以代理状态的 get 来实现。

通过 Object.defineProperty 或者 Proxy 都可以：

``` js
const data = {
    a: 1,
    b: 2
}

let activeEffect
function effect(fn) {
  activeEffect = fn
  fn()
}

const reactiveMap = new WeakMap()
const obj = new Proxy(data, {
    get(targetObj, key) {
        let depsMap = reactiveMap.get(targetObj)；
        if (!depsMap) {
          reactiveMap.set(targetObj, (depsMap = new Map()))
        }
        let deps = depsMap.get(key)
        if (!deps) {
          depsMap.set(key, (deps = new Set()))
        }
        deps.add(activeEffect)
        return targetObj[key]
   }
})
```

effect 会执行传入的回调函数 fn，当你在 fn 里读取 obj.a 的时候，就会触发 get，会拿到对象的响应式的 Map，从里面取出 a 对应的 deps 集合，往里面添加当前的 effect 函数。

这样就完成了一次依赖收集。

当你修改 obj.a 的时候，要通知所有的 deps，所以还要代理 set：

``` js
set(targetObj, key, newVal) {
    targetObj[key] = newVal
    const depsMap = reactiveMap.get(targetObj)
    if (!depsMap) return
    const effects = depsMap.get(key)
    effects && effects.forEach(fn => fn())
}
```

基本的响应式完成了，我们测试一下：

![](/基础的响应式系统/基础的响应式示例.png)

打印了两次，第一次是 1，第二次是 3。

effect 会先执行一次传入的回调函数，触发 get 来收集依赖，这时候打印的 obj.a 是 1

然后当 obj.a 赋值为 3 后，会触发 set，执行收集的依赖，这时候打印 obj.a 是 3

依赖也正确收集到了：

![](/基础的响应式系统/基础响应式依赖示例.png)

结果是对的，我们完成了基本的响应式！

当然，响应式不会只有这么点代码的，我们现在的实现还不完善，还有一些问题。

比如，如果代码里有分支切换，上次执行会依赖 obj.b 下次执行又不依赖了，这时候是不是就有了无效的依赖？

这样一段代码：

``` js
const obj = {
    a: 1,
    b: 2
}
effect(() => {
    console.log(obj.a ? obj.b : 'nothing');
});
obj.a = undefined;
obj.b = 3;
```

第一次执行 effect 函数，obj.a  是 1，这时候会走到第一个分支，又依赖了 obj.b。

把 obj.a 修改为 undefined，触发 set，执行所有的依赖函数，这时候走到分支二，不再依赖 obj.b。

把 obj.b 修改为 3，按理说这时候没有依赖 b 的函数了，我们执行试一下：

![](/基础的响应式系统/分支切换问题示例.png)

第一次打印 2 是对的，也就是走到了第一个分支，打印 obj.b

第二次打印 nothing 也是对的，这时候走到第二个分支。

但是第三次打印 nothing 就不对了，因为这时候 obj.b 已经没有依赖函数了，但是还是打印了。

打印看下 deps，会发现 obj.b 的 deps 没有清除

![](/基础的响应式系统/分支切换问题依赖.png)

所以解决方案就是每次添加依赖前清空下上次的 deps。

怎么清空某个函数关联的所有 deps 呢？

记录下就好了。

我们改造下现有的 effect 函数：

``` js
let activeEffect
function effect(fn) {
  activeEffect = fn
  fn()
}
```

记录下这个 effect 函数被放到了哪些 deps 集合里。也就是：

``` js
let activeEffect
function effect(fn) {
  const effectFn = () => {
      activeEffect = effectFn
      fn()
  }
  effectFn.deps = []
  effectFn()
}
```

对之前的 fn 包一层，在函数上添加个 deps 数组来记录被添加到哪些依赖集合里。

get 收集依赖的时候，也记录一份到这里：

![](/基础的响应式系统/activeEffect添加deps.png)

这样下次再执行这个 effect 函数的时候，就可以把这个 effect 函数从上次添加到的依赖集合里删掉：

![](/基础的响应式系统/effect中添加cleanup.png)

cleanup 实现如下：

``` js
function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.length = 0
}
```

effectFn.deps 数组记录了被添加到的 deps 集合，从中删掉自己。

全删完之后就把上次记录的 deps 数组置空。

我们再来测试下

![](/基础的响应式系统/cleanup问题示例.png)

无限循环打印了，什么鬼？

问题出现在这里：

![](/基础的响应式系统/effect遍历循环问题.png)

set 的时候会执行所有的当前 key 的 deps 集合里的 effect 函数。

而我们执行 effect 函数之前会把它从之前的 deps 集合中清掉：

![](/基础的响应式系统/cleanup中删除循环问题.png)

执行的时候又被添加到了 deps 集合。

这样 delete 又 add，delete 又 add，所以就无限循环了。

这个行为可以用如下简短的代码来表达：

``` js
const set = new Set([1])
set.forEach(item => {
  set.delete(1)
  set.add(1)
  console.log("遍历中")
})
```
语言规范中对此有明确的说明：在调用forEach遍历Set集合时，如果一个值已经被访问过了，但改值被删除并重新添加到集合，如果此时forEach遍历没有结束，那么改值会重新被访问。因此，上面代码会无限执行。

解决的方式就是创建第二个 Set，只用于遍历：

![](/基础的响应式系统/effectsToRun.png)

这样就不会无限循环了。

再测试一次：

![](/基础的响应式系统/用于遍历的set示例.png)

现在当 obj.a 赋值为 undefined 之后，再次执行 effect 函数，obj.b 的 deps 集合就被清空了，所以修改 obj.b  也不会打印啥。

看下现在的响应式数据结构：

![](/基础的响应式系统/解决循环后的依赖.png)

确实，b 的 deps 集合被清空了。

那现在的响应式实现是完善的了么？

也不是，还有一个问题：

如果 effect 嵌套了，那依赖还能正确的收集么？

首先讲下为什么要支持 effect 嵌套，因为组件是可以嵌套的，而且组件里会写 effect，那也就是 effect 嵌套了，所以必须支持嵌套。

我们嵌套下试试：

``` js
effect(() => {
    console.log('effect1');
    effect(() => {
        console.log('effect2');
        obj.b;
    });
    obj.a;
});
obj.a = 3;
```

按理说会打印一次 effect1、一次 effect2，这是最开始的那次执行。

然后 obj.a 修改为 3 后，会触发一次 effect1 的打印，执行内层 effect，又触发一次 effect2 的打印。

也就是会打印 effect1、effect2、effect1、effect2。

我们测试下：

![](/基础的响应式系统/嵌套问题示例.png)

打印了 effect1、effet2 这是对的，但第三次打印的是 effect2，这说明 obj.a 修改后并没有执行外层函数，而是执行的内层函数。

为什么呢？

看下这段代码：

![](/基础的响应式系统/嵌套问题.png)

我们执行 effect 的时候，会把它赋值给一个全局变量 activeEffect，然后后面收集依赖就用的这个。

当嵌套 effect 的时候，内层函数执行后会修改 activeEffect 这样收集到的依赖就不对了。

怎么办呢？

嵌套的话加一个栈来记录 effect 不就行了？

也就是这样：

![](/基础的响应式系统/effectStack.png)

执行 effect 函数前把当前 effectFn 入栈，执行完以后出栈，修改 activeEffect 为栈顶的 effectFn。

这样就保证了收集到的依赖是正确的。

这种思想的应用还是很多的，需要保存和恢复上下文的时候，都是这样加一个栈。

我们再测试一下：

![](/基础的响应式系统/effectsToRun.png)

现在的打印就对了。

无限递归循环还有种情况：effect函数中的自增是一个既读取又设值的操作，其本质上就是副作用函数还没执行完，就要开始下一次执行，导致无限递归地调用自己，于是就产生了栈溢出。解决方法也很简单：如果触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行。

``` js
const effectsToRun = new Set();
effects &&
  effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
effectsToRun.forEach(effectFn => effectFn());
```

至此，我们的响应式系统就算比较完善了。

全部代码如下：

::: details 基础的响应式系统
<<< @/code/响应系统的作用与实现/基础的响应式系统.js
:::

::: details 总结
响应式就是数据变化的时候做一系列联动的处理。

核心是这样一个数据结构：

![](/基础的响应式系统/struct.png)

最外层是 WeakMap，key 为对象，value 为响应式的 Map。这样当对象销毁时，Map 也会销毁。

Map 里保存了每个 key 的依赖集合，用 Set 组织。

我们通过 Proxy 来完成自动的依赖收集，也就是添加 effect 到对应 key 的 deps 的集合里。set 的时候触发所有的 effect 函数执行。
这就是基本的响应式系统。

但是还不够完善，每次执行 effect 前要从上次添加到的 deps 集合中删掉它，然后重新收集依赖。这样可以避免因为分支切换产生的无效依赖。
并且执行 deps 中的 effect 前要创建一个新的 Set 来执行，避免 add、delete 循环起来。

此外，为了支持嵌套 effect，需要在执行 effect 之前把它推到栈里，然后执行完出栈。

无限递归循环还有种情况：effect函数中的自增是一个既读取又设值的操作，其本质上就是副作用函数还没执行完，就要开始下一次执行，导致无限递归地调用自己，于是就产生了栈溢出。解决方法也很简单：如果触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行。

解决了这几个问题之后，就是一个完善的 Vue 响应式系统了。

当然，现在虽然功能是完善的，但是没有实现 computed、watch 等功能，之后再实现。

最后，再来看一下这个数据结构，理解了它就理解了 vue 响应式的核心：

![](/基础的响应式系统/reactive.png)

:::

参考[手写 Vue3 响应式系统：核心就一个数据结构](https://mp.weixin.qq.com/s/U3oSWF1OfhlAU1x9EnQ-sw)

## 实现computed
首先，我们简单回顾一下：

响应式系统的核心就是一个 WeakMap --- Map --- Set 的数据结构。
![](/基础的响应式系统/struct.png)

WeakMap 的 key 是原对象，value 是响应式的 Map。这样当对象销毁的时候，对应的 Map 也会销毁。
Map 的 key 就是对象的每个属性，value 是依赖这个对象属性的 effect 函数的集合 Set。
然后用 Proxy 代理对象的 get 方法，收集依赖该对象属性的 effect 函数到对应 key 的 Set 中。
还要代理对象的 set 方法，修改对象属性的时候调用所有该 key 的 effect 函数。

我们把之前的代码重构一下，把依赖收集和触发依赖函数的执行抽离成 track 和 trigger 函数：
![](/实现computed/依赖收集和依赖触发重构.png)
逻辑还是添加 effect 到对应的 Set，以及触发对应 Set 里的 effect 函数执行，但抽离出来清晰多了。

然后继续实现 computed。

computed 的使用大概是这样的：
``` js
const value = computed(() => {
    return obj.a + obj.b;
});
```
对比下 effect：
```js
effect(() => {
    console.log(obj.a);
});
```
区别只是多了个返回值。
所以我们基于 effect 实现 computed 就是这样的：
```js
function computed(fn) {
    const value = effect(fn);
    return value
}
```
当然，现在的 effect 是没有返回值的，要给它加一下：

![](/实现computed/effect添加返回值.png)

只是在之前执行 effect 函数的基础上把返回值记录下来返回，这个改造还是很容易的。
现在 computed 就能返回计算后的值了：

![](/实现computed/返回值示例.png)

但是现在数据一变，所有的 effect 都执行了，而像 computed 这里的 effect 是没必要每次都重新执行的，只需要在数据变了之后执行。

所以我们添加一个 lazy 的 option 来控制 effect 不立刻执行，而是把函数返回让用户自己执行。

![](/实现computed/添加lazy.png)

然后 computed 里用 effect 的时候就添加一个 lazy 的 option，让 effect 函数不执行，而是返回出来。
computed 里创建一个对象，在 value 的 get 触发时调用该函数拿到最新的值：

![](/实现computed/computed改造传入lazy.png)

我们测试下：

![](/实现computed/lazy示例.png)

可以看到现在 computed 返回值的 value 属性是能拿到计算后的值的，并且修改了 obj.a. 之后会重新执行计算函数，再次拿 value 时能拿到新的值。

只是多执行了一次计算，这是因为 obj.a 变的时候会执行所有的 effect 函数：

![](/实现computed/重复计算.png)

这样每次数据变了都会重新执行 computed 的函数来计算最新的值。

这是没有必要的，effect 的函数是否执行应该也是可以控制的。所以我们要给它加上调度的功能：

![](/实现computed/添加scheduler.png)

可以支持传入 schduler 回调函数，然后执行 effect 的时候，如果有 scheduler 就传给它让用户自己来调度，否则才执行 effect 函数。

这样用户就可以自己控制 effect 函数的执行了：

![](/实现computed/computed改造传入scheduler.png)

然后再试一下刚才的代码：

![](/实现computed/scheduler示例.png)

可以看到，obj.a 变了之后并没有执行 effect 函数来重新计算，因为我们加了 sheduler 来自己调度。这样就避免了数据变了以后马上执行 computed 函数，可以自己控制执行。

现在还有一个问题，每次访问 res.value 都要计算：

![](/实现computed/每次访问都重新计算.png)

能不能加个缓存呢？只有数据变了才需要计算，否则直接拿之前计算的值。

当然是可以的，加个标记就行：

![](/实现computed/添加dirty.png)

scheduler 被调用的时候就说明数据变了，这时候 dirty 设置为 true，然后取 value 的时候就重新计算，之后再改为 false，下次取 value 就直接拿计算好的值了。

我们测试下：

![](/实现computed/dirty示例.png)

我们访问 computed 值的 value 属性时，第一次会重新计算，后面就直接拿计算好的值了。

修改它依赖的数据后，再次访问 value 属性会再次重新计算，然后后面再访问就又会直接拿计算好的值了。

至此，我们完成了 computed 的功能。

但现在的 computed 实现还有一个问题，比如这样一段代码：

``` js
let res = computed(() => {
    return obj.a + obj.b;
});

effect(() => {
    console.log(res.value);
});
```

我们在一个 effect 函数里用到了 computed 值，按理说 obj.a 变了，那 computed 的值也会变，应该触发所有的 effect 函数。

但实际上并没有：

![](/实现computed/computed返回的不是响应式对象.png)

这是为什么呢？

这是因为返回的 computed 值并不是一个响应式的对象，需要把它变为响应式的，也就是 get 的时候 track 收集依赖，set 的时候触发依赖的执行：

![](/实现computed/computed收集和触发依赖.png)

我们再试一下：

![](/实现computed/computed依赖收集触发示例.png)

现在 computed 值变了就能触发依赖它的 effect 了。

至此，我们的 computed 就很完善了。

完整代码如下：

::: details 实现computed
<<< @/code/响应系统的作用与实现/实现computed.js
:::

::: details 总结
我们改造了 effect 函数，让它返回传入的 fn，然后在 computed 里自己执行来拿到计算后的值。

我们又支持了 lazy 和 scheduler 的 option，lazy 是让 effect 不立刻执行传入的函数，scheduler 是在数据变动触发依赖执行的时候回调 sheduler 来调度。

我们通过标记是否 dirty 来实现缓存，当 sheduler 执行的时候，说明数据变了，把 dirty 置为 true，重新计算 computed 的值，否则直接拿缓存。

此外，computed 的 value 并不是响应式对象，我们需要单独的调用下 track 和 trigger。

这样，我们就实现了完善的 computed 功能，vue3 内部也是这样实现的。
:::

参考[手写 Vue3 响应式系统：实现 computed](https://mp.weixin.qq.com/s/ACS7jFcZHTK_r_qpGuZjtw)

## watch的实现原理
所谓watch，其本质就是观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数，举个例子

``` js
watch(obj, () => {
  console.log("数据变了");
});
```

::: details watch的基础实现
<<< @/code/响应系统的作用与实现/watch.js
:::
参考[Vue.js设计与实现 4.9章节](https://www.ituring.com.cn/book/2953)