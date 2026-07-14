---
title: '작성중-GISA Compiler: Function_Semantic Analysis (1)'
description: |-
  어느덧 함수 처리도 의미분석 단계까지 왔다. 이미 구조가 복잡한 심볼 테이블 및 Ident 처리기에 함수 지원을 넣어야 한다. 꽤나 골치아플것 같으니, 꼼꼼히 설계부터 하고 진행해 봐야겠다.


   목표
  기존에는 변수
category: journal
pubDate: 2026-07-14T17:01
---

어느덧 함수 처리도 의미분석 단계까지 왔다. 이미 구조가 복잡한 심볼 테이블 및 Ident 처리기에 함수 지원을 넣어야 한다. 꽤나 골치아플것 같으니, 꼼꼼히 설계부터 하고 진행해 봐야겠다.

### 목표

기존에는 변수만 지원하던 Ident_Symbolizer에서 함수도 처리할 수 있도록 확장해야 한다. 크게 보면 함수 정의와 타입 검사로 나눌 수 있다.
함수 정의에서는, nt_func_declr을 만났을 때의 심볼 등록, ident가 함수인 경우에 대해 처리해야 한다.

### 설계메모

변수/함수 사용: 둘다

구조까진 동일->함수도 변수와 마찬가지로 ast를 순회하다가 IDENT를 만나면 symbol이 finder를 호출하도록. 기존과 동일.

수정할 곳: symbol_finder.
인자로 받는 것은 기존 방식의 토큰 넘버가 아니라 IDENT 노드로 받도록 바꾸기.
노드의 brother가 없다면 기존과 동일하게 검사.
노드의 brother가 있다면 심볼 테이블 뒤져서 지금 처리 중인 함수 찾아서 함수 인자 타입트리 비교하기.

***

함수 선언; 로 시작한다,

ident_sym에서는 func_declr 노드 발견했을 경우에 대한 처리 루트 추가.
이 루트에서도 마찬가지로 symbol_maker(node) 호출로 시작.

symbol_maker 함수는?
입력된 노드가 함수인지 변수인지 판단.
변수면 이전과 그대로.
함수면 - 이미 이 노드의 token_value와 symbol_info->name이 같은 심볼이 있는지 (이전에 선언됐는지) 확인. 없으면 id 등 이것저것 추가해 새 심볼로 만들기,
이전에 있으면: 그 심볼이 함수인지 확인. 변수 심볼이면 오류. 함수 심볼이면 오류가 아니라, 해당 심볼 사용 (그 id 그대로 사용한다)
ㄴ> 함수인데 param_list의 brother가 block인건 함수 정의 이므로, 하나만 올 수 있음.
-> 심볼 인포에 <함수인지 변수인지?>, <정의된 함수인지?>를 나타내는 값 추가하기.

***

① 선언에서 결정되는 심볼인포.

1. 새 심볼인포는 테이블에 저장,
2. name, id, type_tree, size, isfunc = 1, havingbody=0

<101, 0>        -> ~~<150, n>~~
    <2, 0>
      ⋮

~~Func_declr의 child는 symbol로 바뀌고선 사라진다.~~

선언의 경우, 심볼 등록 후 인자의 변수 선언만 scope로 감싸 남기고 사라진다.
정의의 경우, 을 남기고, having body=1,
의 자식으로 body, body의 위쪽에는 변수 선언 추가.

② 사용의 경우:

┌──────────┐

                        → 

                     ⋮                         
└──────────┘

c 규칙 상, 함수 사용 시 인자에서 변수 선언할 수 없는 것을 확인함.

이므로 ~~로~~로 감싸기
-> 인자로 함수호출이 올 수도 있으니

***

변수는 선언해 심볼 등록하고 나면 선언부 유지가 무의미해 삭제하지만, 함수는 정의하는 부분에 표시를 해야 한다. (선언만 있을땐 없애도 무방.)

────────────────────────────────

semantic 시작 시 ident table stack push: 

함수, 함수 밖 변수들은 위에서,

+ 함수 테이블을 만들기.

함수의 경우 심볼인포는 이 테이블에 저장됨.
함수 선언을 만나면, 스택 테이블에 들어가는 것은,
함수 테이블에 저장된 심볼 인포의 주소가 된다.

***

### 구현 과정

우선은 ident_symbloizer 함수에 NT_FUNC_DECLR을 처리하는 부분을 만들어주었다.

```plain
else if (node->token.token_number == NT_FUNC_DECLR) {    
        int symbol_id = symbol_maker(node);
        Node * ident_node = node->son;

        while (ident_node->token.token_number != IDENT) {
            ident_node = get_brother(ident_node);
        }
        
        ident_node->token.token_number = SEM_SYMBOL;
        ident_node->token.token_value = symbol_id;
}
```

NT_VAR_DECLR과 마찬가지로(NT_VAR_DECLR은 기존의 NT_DECLR이 이름이 바뀐 것이다!), symbol_maker에 declr 노드를 보내서 심볼 id를 받아온다. 역시 var_declr과 같이, ident_node의 위치를 찾아 id를 value로 가진 SYMBOL 노드로 바꿔준다. 함수 정의이므로 인자 처리와 본문 처리도 해야하지만, 그에 앞서 symbol_maker 함수가 변수 뿐 아니라 함수도 처리할 수 있도록 확장할 것이다.

먼저, 함수 정의는 main함수 바깥에서 이루어지므로, 기존의 main함수 내부만 ident_symbolizing을 진행하던 방식에서, 전체 ast에 대해 ident_symbolizing을 진행하도록 변경했다. 또한 symbolizing을 진행하기 전 push, 마친 후 pop을 진행해 함수 바깥 scope를 만들어준다.

```before
    ident_symbolizer(symbolized_ast->son->son->brother->brother->brother);
```

```after
   push();
    ident_symbolizer(symbolized_ast);
    pop();
```

설계에서 계획했던 대로, <함수인지 변수인지?>, <정의된 함수인지?>를 나타내는 값을 심볼 인포에 추가했다.

```plain
typedef struct Symbol_info {
    int name;   // IDENT의 value
    int id;     // 모든 테이블에서 겹치지 않는 고유번호. 스코프 위치 함유.
    Node * type_tree;
    int size;
    Symbol_location location;
    int is_func;    // 0: 변수, 1: 함수
    int having_body; // (함수일 경우) 0: 선언만 완료된 상태, 1: 정의까지 완료. (변수일 경우 항상 0)
} Symbol_info;
```

이제 심볼만을 이용해 함수와 변수를 구분할 수 있게 되었으므로, symbol_maker 함수를 건들 차례이다.

```plain
   Symbol_info * symbol = malloc(sizeof(Symbol_info));
    symbol->name = ident_node->token.token_value;
    symbol->id = symbol_id_count++;
    symbol->type_tree = node_maker(NULL, NULL, declr_node->son->token.token_number, 0);    // 이후 확장할 것. 형식도 enum으로 개선하고...
    symbol->size = 4;               // 위의 while문에서 typetree 만드는 함수도 만들어 호출하면 좋을것 같음.
    symbol->location.type = 0;
    symbol->location.location = 0;

    if(ident_node->brother->token.token_number == NT_PARAM_LIST) {  // 함수 선언인 경우
        symbol->is_func = 1;
        if (ident_node->brother->brother->token.token_number == NT_BLOCK) { // 함수 본문이 있는 경우
            symbol->having_body = 1;
        } else {    // 함수 본문이 없는 경우
            symbol->having_body = 0;
        }

        // 함수 인자들을 타입트리에 추가해야 함. 별도 과정으로?
        
    } else {    // 변수 선언인 경우
        symbol->is_func = 0;
        symbol->having_body = 0;
    }
```

첫 시도에는 이처럼, 변수인 경우와 함수인 경우를 한 루트로 처리하며 차이가 있는 부분만 분기시키는 방식으로 도전했다. 하지만 곧 중복 심볼 비교 및 바디 체크 등등 여러 기능들을 추가하기에는 너무 더러워질 것이라고 생각해 바로 롤백시켰다.

```plain
   if (ident_node->brother == NULL || (ident_node->brother != NULL && ident_node->brother->token.token_number != NT_PARAM_LIST)) { // !!!변수 선언일 경우!!!
        printf("선언되는 IDENT는 변수입니다.\n");
        //ident_node->토큰밸류 와 같은 심볼네임이 있는지 현재 테이블 순회해 검토. 있다면 오류 발생.
        [기존과 동일]

        // ***** 심볼 만들어 정보 채우기 *****
        [기존과 동일]

        symbol->is_func = 0;
        symbol->having_body = 0;

        // ***** 심볼을 테이블에 저장 *****
        [기존과 동일]

        // ***** 저장한 심볼을 프린트하기 *****
        [기존과 동일]
        printf("\tIs Function: NO\n");
        printf("\tHaving Body: NO (It's only about function.)\n\n\n");

        return symbol_table_stack[symbol_table_stack_count - 1][symbol_table_count[symbol_table_stack_count - 1] - 1]->id;
        // 변수 선언 끝!


    } else { // !!!함수 선언일 경우!!!
        printf("선언되는 IDENT는 함수입니다.\n");
    }
```

2차 시도. 이번에는 이처럼 변수인 경우와 함수인 경우를 분리하여 동작하도록 구현했다. _그런데 포스팅하며 보니 변수 경로와 함수 경로가 완전히 분리된 함수인데, 조건문으로 한 함수에서 나누는 것보다 두 개의 함수로 분리하는 편이 나을것 같다. 이미 NT에서 함수/변수는 구분되어 들어오는데, 쓸데없이 조건문이 중복되어 비효율적이네..._

함수 선언이 되기 위해서는 ast에서 ident_node의 brother가 존재하며, token_number가 NT_PARAM_LIST여야 한다. 따라서, 그와 반대 조건이라면(ident_node의 brother가 NULL이거나, brother가 NULL이 아니라면 token_number가 NT_PARAM_LIST가 아닌 경우)  변수 선언이라고 판단한다. 변수선언의 경우 기존과 동일한 로직이며, is_func와 having body 정보를 담는 부분만 추가되었다. 변수이므로 is_func는 0, 그리고 body를 가지는 것은 함수 뿐이므로 having_body도 항상 0이다.

이제 함수 symbol을 만들 것이다.

```plain
       symbol->is_func = 1;
        symbol->having_body = 0;

        if (ident_node->brother->brother != NULL && ident_node->brother->brother->token.token_number == NT_BLOCK) {
            if (symbol_table_stack_count == 1) {
                symbol->having_body = 1;
            } else {
                printf("오류: 스코프 베이스가 아닌 곳에서 함수 정의가 시도되었습니다.");
                exit(1);
            }
        }
```

Symbol의 나머지 info들은 변수와 똑같은 로직으로, 노드에서 뽑아낼 수 있다.
함수 심볼을 처리중이므로 is_func는 1이다. 
having_body의 값을 구하는 과정에서, 함수 정의는 오직 base scope에서만 이루어질 수 있다는 규칙 위반을 함께 검사할 것이다. 
함수 정의와 함수 선언을 구분하는 기준으로는, 인자설정 () 이후 {가 오는지, 즉, PARAM_LIST의 brother로 NT_BLOCK을 가지고 있는지를 확인한다. 가지고 있다면 함수 정의인 것이므로, 현재 symbol table의 stack count를 확인한다. count가 1이 아니라면 Block 내부에서 함수정의가 이루어지고 있는 것이므로 오류를 발생시킨다. count가 1이라면 정상적인 함수 정의이므로 having_body를 1로 설정한다.(함수 재정의의 경우, 이미 Symbol이 존재하는 상황이므로, 중복 Symbol check 부분에서 걸러낸다.)

##### 함수 심볼을 테이블에 삽입하기.

여기까지 진행해 잘 만들어낸 심볼을 테이블에 넣을 차례이다. 하지만 어떻게 넣어야 하지? 함수 스코프, 중복 심볼 생성, 심볼 동기화, id 유지 등등, 그냥 아무 테이블에 넣기에는 고려해야 할 문제들이 상당히 많이 겹쳐있다.

우선 교재에서 제안하는 방식은, 함수의 경우에는 id를 부여하지 않고, name을 그대로 함수의 고유값으로 사용하는 것이다. 하지만 내 방식에서는, name을 lexeme value-number 쌍으로 관리해 ast에 저장하고 있기 떄문에 이 방법은 불가능하다.  토큰값만으로 토큰을 찾으려고 할 때, 이 값이 id로 고유화시킨 것인지 name으로 고유화시킨 것인지 구분할 수 없기 때문이다.

가장 먼저 생각했던 방법은 변수와 마찬가지로 그냥 현재 스택 테이블에 심볼을 넣는 것이었다. 물론 불가능하다. 이전에 선언했던 함수인지 확인하기 위해서는 pop된 테이블들까지 전부 뒤져봐야 하고, 여러 곳에서 선언 시 이후 선언에서 비교 및 탐색도 어렵기 때문이다.

함수 테이블을 별도의 flat한 테이블로 분리하면? 우선 그렇게 된다면 심볼 테이블을 사용하는 의미가 사라진다. 새로운 종류의 데이터가 나올때마다 그에 대한 테이블을 만들어 관리한다니.
또한 그렇게 된다면 외부 파일에서 함수를 정의한 후, 현재 파일에서는 내부 스코프 안에서 선언하는 경우 문제가 발생한다. 이 경우라면 원래 동작대로라면 내부 스코프에서만 사용 가능하고, 바깥에서는 접근을 불가능하게 막아야 하지만, flat table에서는 스코프 위치 감지가 불가하니 잘못된 동작이 일어날 수밖에 없다.

다른 컴파일러들의 구현을 찾아보니, \~\~\~에서 \~\~\~로 했다. 이 방법은 \~\~\~해서 적용할수 없다.

한참 헤메다가 꽤 괜찮은 방법을 얻었다.
함수 심볼은, 함수별로 하나씩만 만들어서 주소를 이용해 연결하는 것이다. 심볼 테이블 malloc으로 할당된 symbol의 주소를 요소로 가지니, 심볼 하나를 여러 개의 테이블에 넣을 수 있는 것이다. 이런 방법을 사용한다면, 어느 곳에서 심볼을 수정해도 모든 테이블의 심볼이 수정되고, 변수와 마찬가지로 스코프 테이블에 저장되어 있으므로 스코프 확인도 정상적으로 수행할 수 있고, 같은 존재에 대해 여러개의 심볼이 중복되어 양산되는 일도 피할 수 있다. 함수 심볼들을 저장할 테이블이 새로 필요하긴 하지만, 이 심볼이 존재하는지, 포인터 주소가 어디인지 확인하는 용으로만 사용되므로 새로운 정보를 저장하는 테이블보다는 다른곳에 있는 심볼들을 담아두는 보관함에 가깝다고 생각한다. 

```plain
int func_table_limit;
int func_table_count;
Symbol_info ** func_table;
```

함수 심볼 보관함으로 쓰일 func_table을 선언하고

```plain
   func_table_limit = 4;
    func_table_count = 0;
    func_table = malloc(sizeof(Symbol_info*) * func_table_limit);
```

semantic_analyzer()에서 만든다.

```plain
       // ***** 심볼을 테이블에 저장 *****
        func_table[func_table_count++] = symbol;

        if (func_table_count == func_table_limit) {
            func_table_limit = func_table_limit * 2;
            func_table = realloc(func_table, sizeof(Symbol_info*) * func_table_limit);
        }

        symbol_table_stack[symbol_table_stack_count - 1][symbol_table_count[symbol_table_stack_count - 1]++] = func_table[func_table_count - 1];

        if (symbol_table_count[symbol_table_stack_count - 1] == symbol_table_limit[symbol_table_stack_count - 1]) {
            symbol_table_limit[symbol_table_stack_count - 1] = symbol_table_limit[symbol_table_stack_count - 1] * 2;
            symbol_table_stack[symbol_table_stack_count - 1] = realloc(symbol_table_stack[symbol_table_stack_count - 1], sizeof(Symbol_info*) * symbol_table_limit[symbol_table_stack_count - 1]);
        }
```

심볼 저장부이다. func_table에 심볼을 저장하고, 심볼 스택 테이블에는 func_table에 저장한 해당 심볼의 주소를 저장한다. 이 방식을 통해 한 함수에 대해서는 어디에서 선언하고 사용되더라도 하나의 심볼에 접근하게 된다.

다음으로는 재선언된 함수의 처리이다. 변수 처리 과정에서는, 현재 스코프에 이미 존재하는 이름의 ident로 symbol making을 시도하면 간단하게 오류 처리만 해주면 되었다. 하지만 함수의 경우는 재선언이 허용되므로, 정상적인 방법으로 재선언한 경우에는 해당 이름을 가진 함수의 id를 리턴해주어야 한다.

```plain
       // 이 함수가 이전에 선언된 적이 있는지 확인.
        for (int j = 0; j <= func_table_count - 1; j++) {        // 함수 테이블 순회
            printf("DEBUG. j: %d\n", j);
            if (ident_node->token.token_value == func_table[j]->name) {
                printf("이전에 선언된 적이 있는 함수입니다: Symbol Name <%d, %d>. 새로운 심볼을 생성하지 않고, 해당 함수의 심볼을 이용합니다.\n", ident_node->token.token_number, ident_node->token.token_value);

                if (func_table[j]->having_body == 0) {  // 정의된적 없는 함수인 경우
                    if (ident_node->brother->brother != NULL && ident_node->brother->brother->token.token_number == NT_BLOCK) {
                        if (symbol_table_stack_count == 1) {
                            printf("함수가 정의되었습니다.\n");
                            func_table[j]->having_body = 1;
                        } else {
                            printf("오류: 스코프 베이스가 아닌 곳에서 함수 정의가 시도되었습니다.\n");
                            exit(1);
                        }
                    }
                } else {    // 정의된적 있는 함수인 경우
                    if (ident_node->brother->brother != NULL && ident_node->brother->brother->token.token_number == NT_BLOCK) {
                        printf("오류: 함수가 두 번 이상 정의되었습니다.\n");
                        exit(1);
                    }
                }

                symbol_table_stack[symbol_table_stack_count - 1][symbol_table_count[symbol_table_stack_count - 1]++] = func_table[j];

                if (symbol_table_count[symbol_table_stack_count - 1] == symbol_table_limit[symbol_table_stack_count - 1]) {
                    symbol_table_limit[symbol_table_stack_count - 1] = symbol_table_limit[symbol_table_stack_count - 1] * 2;
                    symbol_table_stack[symbol_table_stack_count - 1] = realloc(symbol_table_stack[symbol_table_stack_count - 1], sizeof(Symbol_info*) * symbol_table_limit[symbol_table_stack_count - 1]);
                }

                return symbol_table_stack[symbol_table_stack_count - 1][symbol_table_count[symbol_table_stack_count - 1] - 1]->id;
                // 이전에 선언된 함수 처리 끝.
            }
        }
```

_글을 작성하다 발견한 것, 한 스코프에서 두 번 이상 같은 이름의 함수를 선언하는 경우에 대한 처리가 누락되었다. 현재 구조에서는 이런 상황이 발생하면 한 테이블 안에 같은 심볼이 둘 이상 삽입될 것이다. 이게 정상인지 문제인지 확인이 필요하다._
이 과정에서는 입력으로 들어온 ident의 이름을 가진 함수심볼이 존재하는지, 한 함수를 두 번 이상 정의하는지, 스코프 베이스가 아닌 곳에서 함수 정의를 시도하진 않는지를 검사하고, 함수 정의 추가 및 스코프 테이블에 심볼 추가를 진행하고, 해당 심볼의 id를 리턴한다.

##### NT_FUNC_DECLR의 처리

이제 심볼 테이블에 ident를 넣기 위해 초반부만 작성했던, NT_FUNC_DECLR의 나머지 부분을 구현했다. 
이 곳에서 해야 할건 함수의 인자로 들어온 것들을 심볼 등록시켜주는 것이다.
