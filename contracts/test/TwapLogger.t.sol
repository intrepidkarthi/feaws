// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../TwapLogger.sol";

contract TwapLoggerTest is Test {
    TwapLogger public logger;
    
    event SliceFilled(
        uint256 indexed sliceIndex,
        address indexed maker,
        address indexed taker,
        uint256 makingAmount,
        uint256 takingAmount
    );

    function setUp() public {
        logger = new TwapLogger();
    }

    function testSliceFilledEvent() public {
        address maker = makeAddr("maker");
        uint256 sliceIndex = 5;
        uint256 makingAmount = 1 ether;
        uint256 takingAmount = 2000 * 1e6; // 2000 USDC

        // Expect the event to be emitted with tx.origin as taker
        vm.expectEmit(true, true, true, true);
        emit SliceFilled(sliceIndex, maker, tx.origin, makingAmount, takingAmount);
        
        // Call the function
        logger.onSliceFilled(sliceIndex, maker, makingAmount, takingAmount);
    }

    function testMultipleSlices() public {
        address maker = makeAddr("maker");
        
        // Test multiple slice fills
        for (uint256 i = 0; i < 3; i++) {
            vm.expectEmit(true, true, true, true);
            emit SliceFilled(i, maker, tx.origin, (i + 1) * 1e18, (i + 1) * 1000 * 1e6);
            
            logger.onSliceFilled(i, maker, (i + 1) * 1e18, (i + 1) * 1000 * 1e6);
        }
    }

    function testFuzzSliceFilled(
        uint256 sliceIndex,
        address maker,
        uint256 makingAmount,
        uint256 takingAmount
    ) public {
        vm.assume(maker != address(0));
        
        vm.expectEmit(true, true, true, true);
        emit SliceFilled(sliceIndex, maker, tx.origin, makingAmount, takingAmount);
        
        logger.onSliceFilled(sliceIndex, maker, makingAmount, takingAmount);
    }
}
